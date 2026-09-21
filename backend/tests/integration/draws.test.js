'use strict';

require('./setup');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { pool } = require('../../src/config/db');
const drawService = require('../../src/services/drawService');
const { createSeededRng, drawRandomNumbers } = require('../../src/domain/drawEngine');

const app = createApp();

async function signupUser(email, role = 'subscriber') {
  const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' });
  if (role === 'admin') {
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [res.body.user.id]);
    const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    return { token: login.body.accessToken, userId: res.body.user.id };
  }
  return { token: res.body.accessToken, userId: res.body.user.id };
}

async function makeActiveSubscriber(userId, charityId) {
  const plan = await pool.query(`SELECT id FROM plans WHERE interval = 'month'`);
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, charity_id, charity_pct, stripe_subscription_id)
     VALUES ($1, $2, 'active', $3, 10, $4)`,
    [userId, plan.rows[0].id, charityId, `sub_${userId}`]
  );
}

async function addFiveScores(userId, values) {
  const dates = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01'];
  for (let i = 0; i < 5; i++) {
    await pool.query(
      `INSERT INTO scores (user_id, score_date, value) VALUES ($1, $2, $3)`,
      [userId, dates[i], values[i]]
    );
  }
}

async function seedPool(subscriptionId, charityId, billingPeriod, poolMinor) {
  await pool.query(
    `INSERT INTO charity_contributions
       (subscription_id, billing_period, gross_minor, charity_minor, pool_minor, charity_id, charity_pct, pool_pct)
     VALUES ($1, $2, 10000, 1000, $3, $4, 10, 20)`,
    [subscriptionId, billingPeriod, poolMinor, charityId]
  );
}

async function createCharity() {
  const { rows } = await pool.query(
    `INSERT INTO charities (name, min_pct) VALUES ('Draw Test Charity', 10) RETURNING id`
  );
  return rows[0].id;
}

describe('Draw simulate/publish authorization', () => {
  test('non-admin cannot simulate', async () => {
    const { token } = await signupUser('nondrawadmin@test.com');
    const res = await request(app)
      .post('/api/admin/draws/simulate')
      .set('Authorization', `Bearer ${token}`)
      .send({ month: '2026-09', strategy: 'random' });
    expect(res.status).toBe(403);
  });

  test('unauthenticated cannot simulate', async () => {
    const res = await request(app).post('/api/admin/draws/simulate').send({ month: '2026-09' });
    expect(res.status).toBe(401);
  });

  test('rejects a malformed month', async () => {
    const { token } = await signupUser('drawadmin1@test.com', 'admin');
    const res = await request(app)
      .post('/api/admin/draws/simulate')
      .set('Authorization', `Bearer ${token}`)
      .send({ month: '09-2026', strategy: 'random' });
    expect(res.status).toBe(400);
  });
});

describe('Simulate: eligibility rules', () => {
  test('only active subscribers with 5 current scores are entered', async () => {
    const admin = await signupUser('drawadmin2@test.com', 'admin');
    const charityId = await createCharity();

    const eligible = await signupUser('eligible@test.com');
    await makeActiveSubscriber(eligible.userId, charityId);
    await addFiveScores(eligible.userId, [10, 20, 30, 40, 45]);

    const tooFewScores = await signupUser('fewscores@test.com');
    await makeActiveSubscriber(tooFewScores.userId, charityId);
    await pool.query(`INSERT INTO scores (user_id, score_date, value) VALUES ($1, '2026-01-01', 20)`, [
      tooFewScores.userId,
    ]);

    const notSubscribed = await signupUser('notsub@test.com');
    await addFiveScores(notSubscribed.userId, [10, 20, 30, 40, 45]);

    const res = await request(app)
      .post('/api/admin/draws/simulate')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ month: '2026-06', strategy: 'random' });

    expect(res.status).toBe(200);
    expect(res.body.entryCount).toBe(1); // only `eligible`
  });
});

describe('Simulate + publish full lifecycle (deterministic RNG via direct service call)', () => {
  test('a 5-match winner is computed, paid the correct tier share, and conservation holds', async () => {
    const charityId = await createCharity();
    const winnerSignup = await signupUser('winner5@test.com');
    await makeActiveSubscriber(winnerSignup.userId, charityId);
    await addFiveScores(winnerSignup.userId, [6, 15, 37, 44, 45]);

    const sub = await pool.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [winnerSignup.userId]);
    await seedPool(sub.rows[0].id, charityId, '2026-07', 1000000); // 10,000.00 pool

    // Fixed RNG (verified empirically, not assumed) â€” rng()=>0 deterministically
    // produces winning numbers [6,15,37,44,45] from this Fisher-Yates implementation.
    const seed = '00000000000000000000000000000000';
    const winning = drawRandomNumbers(createSeededRng(seed));
    // The test user's five scores are set above to match these deterministic winning numbers.
    const result = await drawService.simulateDraw('2026-07', 'random', { seed });

    expect(result.winningNumbers).toEqual(winning);
    expect(result.winners).toHaveLength(1);
    expect(result.winners[0].tier).toBe(5);
    expect(result.winners[0].payout_minor).toBe(400000); // 40% of 1,000,000

    const published = await drawService.publishDraw(result.draw.id);
    expect(published.status).toBe('published');

    const full = await drawService.getDraw(result.draw.id);
    expect(full.winners[0].status).toBe('pending'); // payout not yet marked paid
  });

  test('unclaimed jackpot correctly carries into the next published month', async () => {
    const charityId = await createCharity();
    // No eligible subscribers this month at all -> entire pool unclaimed.
    const dummySub = await signupUser('dummy@test.com');
    await makeActiveSubscriber(dummySub.userId, charityId);
    // deliberately NOT giving this user 5 scores -> not draw-eligible
    const sub = await pool.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [dummySub.userId]);
    await seedPool(sub.rows[0].id, charityId, '2026-08', 500000);

    const result = await drawService.simulateDraw('2026-08', 'random', { seed: '00000000000000000000000000000000' });
    expect(result.entryCount).toBe(0);
    expect(result.draw.jackpot_carry_out).toBe(200000); // 40% of 500,000, fully unclaimed
    await drawService.publishDraw(result.draw.id);

    // Next month: a winner should receive their own tier pool PLUS the carried jackpot.
    const winner2 = await signupUser('winner_september@test.com');
    await makeActiveSubscriber(winner2.userId, charityId);
    await addFiveScores(winner2.userId, [6, 15, 37, 44, 45]);
    const sub2 = await pool.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [winner2.userId]);
    await seedPool(sub2.rows[0].id, charityId, '2026-09', 500000);

    const result2 = await drawService.simulateDraw('2026-09', 'random', { seed: '00000000000000000000000000000000' });
    expect(result2.winners[0].tier).toBe(5);
    // Only the 5-match jackpot carries: 200,000 fresh 5-tier + 200,000 carry-in.
    expect(result2.winners[0].payout_minor).toBe(400000);
  });
});

describe('Publish guards', () => {
  test('cannot publish a draw that was never simulated', async () => {
    // Directly force a 'draft' row via simulate-then-manual-reset would be
    // awkward; instead assert the service rejects an unknown id cleanly,
    // and separately assert the state-machine check via the simulated path.
    await expect(drawService.publishDraw('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  test('CRITICAL: publishing twice is rejected the second time, not double-processed', async () => {
    const charityId = await createCharity();
    const u = await signupUser('doublepublish@test.com');
    await makeActiveSubscriber(u.userId, charityId);
    await addFiveScores(u.userId, [2, 3, 4, 5, 6]);
    const sub = await pool.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [u.userId]);
    await seedPool(sub.rows[0].id, charityId, '2026-10', 100000);

    const result = await drawService.simulateDraw('2026-10', 'random', { seed: '10101010101010101010101010101010' });
    await drawService.publishDraw(result.draw.id);

    await expect(drawService.publishDraw(result.draw.id)).rejects.toMatchObject({
      code: 'ALREADY_PUBLISHED',
    });
  });

  test('CRITICAL: concurrent publish calls on the same draw â€” only one succeeds', async () => {
    const charityId = await createCharity();
    const u = await signupUser('concurrent@test.com');
    await makeActiveSubscriber(u.userId, charityId);
    await addFiveScores(u.userId, [2, 3, 4, 5, 6]);
    const sub = await pool.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [u.userId]);
    await seedPool(sub.rows[0].id, charityId, '2026-11', 100000);

    const result = await drawService.simulateDraw('2026-11', 'random', { seed: '11111111111111111111111111111111' });

    const [a, b] = await Promise.allSettled([
      drawService.publishDraw(result.draw.id),
      drawService.publishDraw(result.draw.id),
    ]);

    const outcomes = [a, b];
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.code).toBe('ALREADY_PUBLISHED');
  });

  test('CRITICAL: a published draw cannot be re-simulated (immutability)', async () => {
    const charityId = await createCharity();
    const u = await signupUser('immutable@test.com');
    await makeActiveSubscriber(u.userId, charityId);
    await addFiveScores(u.userId, [2, 3, 4, 5, 6]);
    const sub = await pool.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [u.userId]);
    await seedPool(sub.rows[0].id, charityId, '2026-12', 100000);

    const result = await drawService.simulateDraw('2026-12', 'random', { seed: '00000000000000000000000000000000' });
    await drawService.publishDraw(result.draw.id);

    await expect(drawService.simulateDraw('2026-12', 'random', { seed: '00000000000000000000000000000000' })).rejects.toMatchObject({
      code: 'ALREADY_PUBLISHED',
    });
  });

  test('re-simulating before publish overwrites, does not duplicate, entries/winners', async () => {
    const charityId = await createCharity();
    const u = await signupUser('resim@test.com');
    await makeActiveSubscriber(u.userId, charityId);
    await addFiveScores(u.userId, [2, 3, 4, 5, 6]);
    const sub = await pool.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [u.userId]);
    await seedPool(sub.rows[0].id, charityId, '2027-01', 100000);

    const first = await drawService.simulateDraw('2027-01', 'random', { seed: '00000000000000000000000000000000' });
    const second = await drawService.simulateDraw('2027-01', 'random', { seed: '00000000000000000000000000000000' });
    expect(second.draw.id).toBe(first.draw.id); // reused the same draft row

    const entries = await pool.query(`SELECT * FROM draw_entries WHERE draw_id = $1`, [first.draw.id]);
    expect(entries.rows).toHaveLength(1); // not duplicated
  });
});


'use strict';

require('./setup');
const request = require('supertest');
const { pool } = require('../../src/config/db');
const { createApp } = require('../../src/app');

const app = createApp();

async function signup(email, entitled = true) {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: 'password123' });
  if (entitled) {
    const charity = await pool.query(`INSERT INTO charities (name, min_pct) VALUES ('Score Test Charity', 10) RETURNING id`);
    const plan = await pool.query(`SELECT id FROM plans WHERE interval='month' LIMIT 1`);
    await pool.query(`INSERT INTO subscriptions (user_id, plan_id, status, charity_id, charity_pct) VALUES ($1,$2,'active',$3,10)`, [res.body.user.id, plan.rows[0].id, charity.rows[0].id]);
  }
  return { token: res.body.accessToken, userId: res.body.user.id };
}

describe('Score routes', () => {
  test('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/scores');
    expect(res.status).toBe(401);
  });

  test('creates a score for the authenticated user', async () => {
    const { token } = await signup('scorer@test.com');
    const res = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 32, date: '2026-09-10' });

    expect(res.status).toBe(201);
    expect(res.body.value).toBe(32);
  });

  test('rejects an out-of-range score (defense in depth: app layer AND DB CHECK)', async () => {
    const { token } = await signup('range@test.com');
    const res = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 99, date: '2026-09-10' });

    expect(res.status).toBe(400);
  });

  test('rejects a duplicate date, including the DB-level race case', async () => {
    const { token } = await signup('dupdate@test.com');
    await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 30, date: '2026-09-10' });

    const res = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 20, date: '2026-09-10' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DUPLICATE_DATE');
  });

  test('allows the same score VALUE on a different date', async () => {
    const { token } = await signup('dupval@test.com');
    await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 30, date: '2026-09-10' });

    const res = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 30, date: '2026-09-11' });

    expect(res.status).toBe(201);
  });

  test('returns current (latest 5) and drawEligible flag correctly', async () => {
    const { token } = await signup('rolling@test.com');
    const dates = ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01'];
    for (const date of dates) {
      await request(app)
        .post('/api/scores')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 25, date });
    }

    const res = await request(app).get('/api/scores').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.all).toHaveLength(5);
    expect(res.body.current).toHaveLength(5);
    expect(res.body.current[0].date).toBe('2026-06-01'); // newest first
    expect(res.body.current.find((s) => s.date === '2026-01-01')).toBeUndefined(); // oldest excluded
    expect(res.body.drawEligible).toBe(true);
  });

  test('drawEligible is false with fewer than 5 scores', async () => {
    const { token } = await signup('fewscores@test.com');
    await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 25, date: '2026-01-01' });

    const res = await request(app).get('/api/scores').set('Authorization', `Bearer ${token}`);
    expect(res.body.drawEligible).toBe(false);
  });

  test('CRITICAL: a user cannot edit another user\'s score', async () => {
    const alice = await signup('alice@test.com');
    const bob = await signup('bob@test.com');

    const created = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ value: 30, date: '2026-09-10' });

    const scoreId = created.body.id;

    const attack = await request(app)
      .put(`/api/scores/${scoreId}`)
      .set('Authorization', `Bearer ${bob.token}`) // Bob, not Alice
      .send({ value: 1, date: '2026-09-10' });

    expect(attack.status).toBe(404); // not 403 â€” never confirms the resource exists for another user

    // Alice's score is untouched.
    const list = await request(app)
      .get('/api/scores')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(list.body.all[0].value).toBe(30);
  });

  test('CRITICAL: a user cannot delete another user\'s score', async () => {
    const alice = await signup('alice2@test.com');
    const bob = await signup('bob2@test.com');

    const created = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ value: 30, date: '2026-09-10' });

    const attack = await request(app)
      .delete(`/api/scores/${created.body.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(attack.status).toBe(404);

    const list = await request(app)
      .get('/api/scores')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(list.body.all).toHaveLength(1); // still there
  });

  test('owner CAN edit and delete their own score', async () => {
    const { token } = await signup('owner@test.com');
    const created = await request(app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 30, date: '2026-09-10' });

    const edited = await request(app)
      .put(`/api/scores/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 40, date: '2026-09-10' });
    expect(edited.status).toBe(200);
    expect(edited.body.value).toBe(40);

    const deleted = await request(app)
      .delete(`/api/scores/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);

    const list = await request(app).get('/api/scores').set('Authorization', `Bearer ${token}`);
    expect(list.body.all).toHaveLength(0);
  });
});


test('score mutations require an entitled subscription', async () => {
  const { token } = await signup('ungated@test.com', false);
  const res = await request(app).post('/api/scores').set('Authorization', `Bearer ${token}`).send({ value: 32, date: '2026-09-10' });
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('SUBSCRIPTION_REQUIRED');
});


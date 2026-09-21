'use strict';

// Only the actual network call to Supabase Storage is mocked (blocked in
// this sandbox, same reasoning as the Stripe Checkout mock) -- ownership
// checks, DB writes, and the approve-before-payout business rule are all
// real. Must be smoke-tested against a live Supabase project before relying
// on it for the real submission.
jest.mock('../../src/config/supabaseStorage', () => ({
  uploadPrivateFile: jest.fn().mockResolvedValue('mocked/path.png'),
  getSignedUrl: jest.fn().mockImplementation((path) => Promise.resolve(`https://mock-signed-url/${path}`)),
  BUCKET: 'winner-proofs',
}));

require('./setup');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { pool } = require('../../src/config/db');
const VALID_PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const storage = require('../../src/config/supabaseStorage');

const app = createApp();

async function signup(email, role = 'subscriber') {
  const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' });
  if (role === 'admin') {
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [res.body.user.id]);
    const login = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
    return { token: login.body.accessToken, userId: res.body.user.id };
  }
  return { token: res.body.accessToken, userId: res.body.user.id };
}

let drawMonthCounter = 0;
async function createWinner(userId, { tier = 5, payoutMinor = 400000 } = {}) {
  drawMonthCounter = (drawMonthCounter % 12) + 1;
  const month = `2026-${String(drawMonthCounter).padStart(2, '0')}`;
  const draw = await pool.query(
    `INSERT INTO draws (month, strategy, status) VALUES ($1, 'random', 'simulated') RETURNING id`,
    [month]
  );
  const entry = await pool.query(
    `INSERT INTO draw_entries (draw_id, user_id, ticket_numbers, score_dates) VALUES ($1,$2,ARRAY[1,2,3,4,5],ARRAY['2026-01-01'::date,'2026-01-02'::date,'2026-01-03'::date,'2026-01-04'::date,'2026-01-05'::date]) RETURNING id`,
    [draw.rows[0].id, userId]
  );
  const winner = await pool.query(
    `INSERT INTO winners (draw_id, draw_entry_id, user_id, tier, payout_minor, status)
     VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
    [draw.rows[0].id, entry.rows[0].id, userId, tier, payoutMinor]
  );
  await pool.query(`UPDATE draws SET status='published', published_at=now() WHERE id=$1`, [draw.rows[0].id]);
  return winner.rows[0];
}

describe('Winner proof upload', () => {
  test('unauthenticated cannot upload', async () => {
    const res = await request(app).post('/api/winners/some-id/proof');
    expect(res.status).toBe(401);
  });

  test('owner can upload a valid proof image', async () => {
    const alice = await signup('winnerowner@test.com');
    const winner = await createWinner(alice.userId);

    const res = await request(app)
      .post(`/api/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('proof', VALID_PNG, { filename: 'proof.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(storage.uploadPrivateFile).toHaveBeenCalled();
  });

  test('rejects a disallowed file type', async () => {
    const alice = await signup('winnerowner2@test.com');
    const winner = await createWinner(alice.userId);

    const res = await request(app)
      .post(`/api/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('proof', VALID_PNG, { filename: 'proof.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE_TYPE');
  });

  test('CRITICAL: a different user cannot upload proof for someone else\'s win', async () => {
    const alice = await signup('winowner3@test.com');
    const bob = await signup('attacker3@test.com');
    const winner = await createWinner(alice.userId);

    const res = await request(app)
      .post(`/api/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${bob.token}`) // Bob, not Alice
      .attach('proof', VALID_PNG, { filename: 'proof.png', contentType: 'image/png' });

    expect(res.status).toBe(404); // never confirms the winner row exists for another user
  });

  test('no file provided is rejected', async () => {
    const alice = await signup('nofile@test.com');
    const winner = await createWinner(alice.userId);
    const res = await request(app)
      .post(`/api/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_REQUIRED');
  });
});

describe('Admin winner review + payout', () => {
  async function uploadAndReturn(token, winnerId) {
    return request(app)
      .post(`/api/winners/${winnerId}/proof`)
      .set('Authorization', `Bearer ${token}`)
      .attach('proof', VALID_PNG, { filename: 'proof.png', contentType: 'image/png' });
  }

  test('non-admin cannot review or mark paid', async () => {
    const alice = await signup('reviewnonadmin@test.com');
    const winner = await createWinner(alice.userId);
    await uploadAndReturn(alice.token, winner.id);

    const reviewRes = await request(app)
      .put(`/api/admin/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ decision: 'approved' });
    expect(reviewRes.status).toBe(403);

    const payoutRes = await request(app)
      .put(`/api/admin/winners/${winner.id}/payout`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(payoutRes.status).toBe(403);
  });

  test('CRITICAL: payout is rejected without an approved proof', async () => {
    const admin = await signup('payoutadmin1@test.com', 'admin');
    const alice = await signup('nopayoutyet@test.com');
    const winner = await createWinner(alice.userId);

    // No proof uploaded at all.
    const res1 = await request(app)
      .put(`/api/admin/winners/${winner.id}/payout`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res1.status).toBe(400);
    expect(res1.body.code).toBe('PROOF_NOT_APPROVED');

    // Proof uploaded but not yet reviewed.
    await uploadAndReturn(alice.token, winner.id);
    const res2 = await request(app)
      .put(`/api/admin/winners/${winner.id}/payout`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res2.status).toBe(400);
    expect(res2.body.code).toBe('PROOF_NOT_APPROVED');
  });

  test('full happy path: upload -> approve -> pay, and paying twice is rejected', async () => {
    const admin = await signup('payoutadmin2@test.com', 'admin');
    const alice = await signup('happypath@test.com');
    const winner = await createWinner(alice.userId);

    await uploadAndReturn(alice.token, winner.id);

    const approve = await request(app)
      .put(`/api/admin/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'approved' });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('approved');

    const pay = await request(app)
      .put(`/api/admin/winners/${winner.id}/payout`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(pay.status).toBe(200);
    expect(pay.body.status).toBe('paid');

    const payAgain = await request(app)
      .put(`/api/admin/winners/${winner.id}/payout`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(payAgain.status).toBe(409);
    expect(payAgain.body.code).toBe('ALREADY_PAID');
  });

  test('rejected proof allows resubmission, and a subsequent approval works', async () => {
    const admin = await signup('payoutadmin3@test.com', 'admin');
    const alice = await signup('resubmit@test.com');
    const winner = await createWinner(alice.userId);

    await uploadAndReturn(alice.token, winner.id);
    const reject = await request(app)
      .put(`/api/admin/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'rejected' });
    expect(reject.body.status).toBe('rejected');

    // Resubmit.
    const second = await uploadAndReturn(alice.token, winner.id);
    expect(second.status).toBe(201);

    const approve = await request(app)
      .put(`/api/admin/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'approved' });
    expect(approve.body.status).toBe('approved');
  });

  test('dashboard keeps one winner row and exposes only the latest proof version', async () => {
    const alice = await signup('latestproof@test.com');
    const winner = await createWinner(alice.userId);
    await uploadAndReturn(alice.token, winner.id);
    const admin = await signup('latestproofadmin@test.com', 'admin');
    await request(app).put(`/api/admin/winners/${winner.id}/proof`).set('Authorization', `Bearer ${admin.token}`).send({ decision: 'rejected' });
    await uploadAndReturn(alice.token, winner.id);
    const list = await request(app).get('/api/winners').set('Authorization', `Bearer ${alice.token}`);
    expect(list.status).toBe(200);
    expect(list.body.winnings).toHaveLength(1);
    expect(list.body.winnings[0].proof_status).toBe('pending');
  });

  test('rejects a proof larger than 5MB with a controlled business error', async () => {
    const alice = await signup('toolargeproof@test.com');
    const winner = await createWinner(alice.userId);
    const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1, 0x00);
    const res = await request(app).post(`/api/winners/${winner.id}/proof`).set('Authorization', `Bearer ${alice.token}`).attach('proof', tooLarge, { filename: 'proof.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  test('a paid winner proof cannot be reviewed again', async () => {
    const admin = await signup('reviewpaidadmin@test.com', 'admin');
    const alice = await signup('reviewpaiduser@test.com');
    const winner = await createWinner(alice.userId);
    await uploadAndReturn(alice.token, winner.id);
    await request(app).put(`/api/admin/winners/${winner.id}/proof`).set('Authorization', `Bearer ${admin.token}`).send({ decision: 'approved' });
    await request(app).put(`/api/admin/winners/${winner.id}/payout`).set('Authorization', `Bearer ${admin.token}`);
    const res = await request(app).put(`/api/admin/winners/${winner.id}/proof`).set('Authorization', `Bearer ${admin.token}`).send({ decision: 'rejected' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_PAID');
  });

  test('a winner cannot upload a new proof after being paid', async () => {
    const admin = await signup('payoutadmin4@test.com', 'admin');
    const alice = await signup('lockedafterpaid@test.com');
    const winner = await createWinner(alice.userId);

    await uploadAndReturn(alice.token, winner.id);
    await request(app)
      .put(`/api/admin/winners/${winner.id}/proof`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ decision: 'approved' });
    await request(app).put(`/api/admin/winners/${winner.id}/payout`).set('Authorization', `Bearer ${admin.token}`);

    const res = await uploadAndReturn(alice.token, winner.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_PAID');
  });
});

describe('GET /api/winners (mine)', () => {
  test('a user only sees their own winnings', async () => {
    const alice = await signup('mywinnings1@test.com');
    const bob = await signup('mywinnings2@test.com');
    await createWinner(alice.userId);
    await createWinner(bob.userId);

    const res = await request(app).get('/api/winners').set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.winnings).toHaveLength(1);
    expect(res.body.winnings[0].user_id).toBe(alice.userId);
  });
});




'use strict';

// The actual network call to api.stripe.com cannot be made from this
// sandbox (egress is domain-restricted and api.stripe.com is not on the
// allowlist) -- that ONE call is mocked. Everything else -- auth, plan/
// charity lookup, min-% validation, metadata construction, the DB -- is
// real and runs against the real test database. This must be re-verified
// against the live Stripe test API once real keys/network are available.
jest.mock('../../src/config/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ id: 'cs_test_mock', url: 'https://checkout.stripe.com/mock' }),
      },
    },
    subscriptions: {
      cancel: jest.fn().mockResolvedValue({ id: 'sub_admin_cancel', status: 'canceled' }),
    },
  },
}));

require('./setup');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { pool } = require('../../src/config/db');
const { stripe } = require('../../src/config/stripe');

const app = createApp();

async function signup(email) {
  const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' });
  return res.body.accessToken;
}

async function createCharity(minPct = 10) {
  const { rows } = await pool.query(
    `INSERT INTO charities (name, min_pct) VALUES ('Checkout Test Charity', $1) RETURNING id, min_pct`,
    [minPct]
  );
  return rows[0];
}

async function getMonthlyPlanId() {
  const { rows } = await pool.query(`SELECT id FROM plans WHERE interval = 'month'`);
  return rows[0].id;
}

describe('POST /api/subscriptions/checkout', () => {
  test('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/subscriptions/checkout').send({});
    expect(res.status).toBe(401);
  });

  test('creates a Checkout session with correct metadata for a valid plan/charity', async () => {
    const token = await signup('checkout1@test.com');
    const charity = await createCharity(10);
    const planId = await getMonthlyPlanId();

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId, charityId: charity.id, charityPct: 25 });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.com/mock');

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        metadata: expect.objectContaining({ charityPct: '25', planId, charityId: charity.id }),
      })
    );
  });

  test('rejects a charity % below that charity\'s minimum', async () => {
    const token = await signup('checkout2@test.com');
    const charity = await createCharity(20);
    const planId = await getMonthlyPlanId();

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId, charityId: charity.id, charityPct: 10 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CHARITY_PCT');
  });

  test('defaults to the charity\'s minimum % when none is specified', async () => {
    const token = await signup('checkout3@test.com');
    const charity = await createCharity(15);
    const planId = await getMonthlyPlanId();

    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId, charityId: charity.id });

    expect(res.status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ charityPct: '15' }) })
    );
  });

  test('blocks a second checkout while an entitled subscription exists', async () => {
    const token = await signup('duplicate-sub@test.com');
    const user = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const charity = await createCharity(10);
    const planId = await getMonthlyPlanId();
    await pool.query(`INSERT INTO subscriptions(user_id,plan_id,status,charity_id,charity_pct,pool_pct_snapshot,stripe_subscription_id) VALUES($1,$2,'active',$3,10,20,$4)`, [user.body.user.id, planId, charity.id, 'sub_existing']);
    const res = await request(app).post('/api/subscriptions/checkout').set('Authorization', `Bearer ${token}`).send({planId,charityId:charity.id,charityPct:10});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SUBSCRIPTION_EXISTS');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalledWith(expect.objectContaining({customer_email:'duplicate-sub@test.com'}));
  });

  test('404 for an unknown plan', async () => {
    const token = await signup('checkout4@test.com');
    const charity = await createCharity();
    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ planId: '00000000-0000-0000-0000-000000000000', charityId: charity.id });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PLAN_NOT_FOUND');
  });
});

describe('GET /api/subscriptions/me', () => {
  test('returns null when the user has no subscription yet', async () => {
    const token = await signup('nosub@test.com');
    const res = await request(app).get('/api/subscriptions/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.subscription).toBeNull();
  });
});


describe('Admin Stripe cancellation', () => {
  test('requests cancellation in Stripe first and does not locally mark cancelled until webhook', async () => {
    const adminRes = await request(app).post('/api/auth/signup').send({ email: 'stripecanceladmin@test.com', password: 'password123' });
    await pool.query(`UPDATE users SET role='admin' WHERE id=$1`, [adminRes.body.user.id]);
    const login = await request(app).post('/api/auth/login').send({ email: 'stripecanceladmin@test.com', password: 'password123' });
    const charity = await createCharity();
    const planId = await getMonthlyPlanId();
    const userId = adminRes.body.user.id;
    await pool.query(`INSERT INTO subscriptions(user_id,plan_id,status,charity_id,charity_pct,pool_pct_snapshot,stripe_subscription_id) VALUES($1,$2,'active',$3,10,20,'sub_admin_cancel')`, [userId,planId,charity.id]);
    const res = await request(app).put(`/api/admin/users/${userId}/cancel-subscription`).set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(202);
    expect(res.body.cancellationRequested).toBe(true);
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_admin_cancel');
    const local = await pool.query(`SELECT status FROM subscriptions WHERE user_id=$1`, [userId]);
    expect(local.rows[0].status).toBe('active');
  });
});

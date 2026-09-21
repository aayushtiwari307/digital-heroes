'use strict';

require('./setup');
const request = require('supertest');
const { stripe } = require('../../src/config/stripe');
const { createApp } = require('../../src/app');
const { pool } = require('../../src/config/db');

const app = createApp();
const WEBHOOK_SECRET = 'whsec_test_secret_for_integration_tests';

beforeAll(() => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

async function signup(email) {
  const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' });
  return res.body.user.id;
}

async function createCharity() {
  const { rows } = await pool.query(
    `INSERT INTO charities (name, min_pct) VALUES ('Test Charity', 10) RETURNING id, min_pct`
  );
  return rows[0];
}

async function getMonthlyPlanId() {
  const { rows } = await pool.query(`SELECT id, price_minor FROM plans WHERE interval = 'month'`);
  return rows[0];
}

function signedRequest(eventPayload) {
  const payload = JSON.stringify(eventPayload);
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return { payload, header };
}

function buildCheckoutCompletedEvent({ id, userId, planId, charityId, charityPct }) {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: 'cus_test123',
        subscription: `sub_test_${id}`,
        metadata: { userId, planId, charityId, charityPct: String(charityPct) },
      },
    },
  };
}

describe('POST /api/webhooks/stripe', () => {
  test('rejects a request with an invalid signature', async () => {
    const { payload } = signedRequest({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'garbage-signature')
      .send(payload);

    expect(res.status).toBe(400);
  });

  test('rejects a request with no signature header', async () => {
    const { payload } = signedRequest({ id: 'evt_2', type: 'checkout.session.completed', data: { object: {} } });
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
  });

  test('a validly-signed checkout.session.completed activates the subscription and writes the ledger', async () => {
    const userId = await signup('subscriber1@test.com');
    const charity = await createCharity();
    const plan = await getMonthlyPlanId();

    const event = buildCheckoutCompletedEvent({
      id: 'evt_checkout_1',
      userId,
      planId: plan.id,
      charityId: charity.id,
      charityPct: 15,
    });
    const { payload, header } = signedRequest(event);

    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.alreadyProcessed).toBe(false);

    const sub = await pool.query(`SELECT * FROM subscriptions WHERE user_id = $1`, [userId]);
    expect(sub.rows).toHaveLength(1);
    expect(sub.rows[0].status).toBe('active');
    expect(sub.rows[0].charity_pct).toBe(15);

    const invoiceEvent = { id: 'evt_invoice_1', type: 'invoice.paid', data: { object: { id: 'in_test_1', subscription: `sub_test_evt_checkout_1`, period: { start: 1756684800, end: 1759276800 } } } };
    const invoiceSigned = signedRequest(invoiceEvent);
    const invoiceRes = await request(app).post('/api/webhooks/stripe').set('Content-Type','application/json').set('stripe-signature',invoiceSigned.header).send(invoiceSigned.payload);
    expect(invoiceRes.status).toBe(200);

    const ledger = await pool.query(`SELECT * FROM charity_contributions WHERE subscription_id = $1`, [
      sub.rows[0].id,
    ]);
    expect(ledger.rows).toHaveLength(1);
    // gross = plan.price_minor (monthly plan, no /12 division), charity 15% of gross
    const expectedCharityMinor = Math.floor((plan.price_minor * 15) / 100);
    expect(ledger.rows[0].charity_minor).toBe(expectedCharityMinor);
    expect(ledger.rows[0].pool_pct).toBe(20); // seeded platform_settings default
  });

  test('CRITICAL: replaying the same event id is a safe no-op (idempotency)', async () => {
    const userId = await signup('subscriber2@test.com');
    const charity = await createCharity();
    const plan = await getMonthlyPlanId();

    const event = buildCheckoutCompletedEvent({
      id: 'evt_replay_test',
      userId,
      planId: plan.id,
      charityId: charity.id,
      charityPct: 10,
    });
    const { payload, header } = signedRequest(event);

    const first = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(payload);
    expect(first.body.alreadyProcessed).toBe(false);

    // Checkout event replay is a no-op.
    const second = await request(app).post('/api/webhooks/stripe').set('Content-Type','application/json').set('stripe-signature',header).send(payload);
    expect(second.status).toBe(200);
    expect(second.body.alreadyProcessed).toBe(true);

    const invoiceEvent = { id: 'evt_replay_invoice', type: 'invoice.paid', data: { object: { id: 'in_replay_1', subscription: `sub_test_evt_replay_test`, period: { start: 1756684800, end: 1759276800 } } } };
    const invoiceSigned=signedRequest(invoiceEvent);
    const firstInvoice=await request(app).post('/api/webhooks/stripe').set('Content-Type','application/json').set('stripe-signature',invoiceSigned.header).send(invoiceSigned.payload);
    expect(firstInvoice.status).toBe(200);
    const secondInvoice=await request(app).post('/api/webhooks/stripe').set('Content-Type','application/json').set('stripe-signature',invoiceSigned.header).send(invoiceSigned.payload);
    expect(secondInvoice.body.alreadyProcessed).toBe(true);

    // No duplicate financial effect: exactly one ledger row, not two.
    const ledger = await pool.query(
      `SELECT cc.* FROM charity_contributions cc
       JOIN subscriptions s ON s.id = cc.subscription_id
       WHERE s.user_id = $1`,
      [userId]
    );
    expect(ledger.rows).toHaveLength(1);
  });

  test('customer.subscription.deleted marks the subscription cancelled', async () => {
    const userId = await signup('subscriber3@test.com');
    const charity = await createCharity();
    const plan = await getMonthlyPlanId();
    const stripeSubId = 'sub_cancel_test';

    const activated = buildCheckoutCompletedEvent({
      id: 'evt_activate_for_cancel',
      userId,
      planId: plan.id,
      charityId: charity.id,
      charityPct: 10,
    });
    activated.data.object.subscription = stripeSubId;
    const activatedSigned = signedRequest(activated);
    await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', activatedSigned.header)
      .send(activatedSigned.payload);

    const cancelEvent = {
      id: 'evt_cancel_1',
      type: 'customer.subscription.deleted',
      data: { object: { id: stripeSubId } },
    };
    const { payload, header } = signedRequest(cancelEvent);
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(payload);
    expect(res.status).toBe(200);

    const sub = await pool.query(`SELECT status FROM subscriptions WHERE stripe_subscription_id = $1`, [
      stripeSubId,
    ]);
    expect(sub.rows[0].status).toBe('cancelled');

    const history = await pool.query(
      `SELECT event_type FROM subscription_history sh
       JOIN subscriptions s ON s.id = sh.subscription_id
       WHERE s.stripe_subscription_id = $1 ORDER BY effective_at`,
      [stripeSubId]
    );
    expect(history.rows.map((r) => r.event_type)).toEqual(['activated', 'cancelled']);
  });

  test('an unrecognized (non-Digital-Heroes) session is safely ignored, not errored', async () => {
    const event = {
      id: 'evt_foreign',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_x', subscription: 'sub_x', metadata: {} } },
    };
    const { payload, header } = signedRequest(event);
    const res = await request(app)
      .post('/api/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(payload);
    expect(res.status).toBe(200);
  });
});

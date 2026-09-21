'use strict';

const { pool } = require('../../src/config/db');

afterEach(async () => {
  // Real DB, real TRUNCATE — every test starts from a clean slate.
  await pool.query(
    'TRUNCATE TABLE users, scores, score_audit, subscriptions, charities, charity_media, auth_refresh_tokens, stripe_events, ' +
      'subscription_history, charity_contributions, draws, draw_entries, draw_results, ' +
      'winners, winner_proofs, admin_audit_log ' +
      'RESTART IDENTITY CASCADE'
  );
});

afterAll(async () => {
  await pool.end();
});

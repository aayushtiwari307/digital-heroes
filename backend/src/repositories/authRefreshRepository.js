'use strict';
const { pool } = require('../config/db');

async function insert(client, { jti, userId, tokenHash, expiresAt }) {
  const { rows } = await client.query(
    `INSERT INTO auth_refresh_tokens (jti, user_id, token_hash, expires_at) VALUES ($1,$2,$3,$4) RETURNING *`,
    [jti, userId, tokenHash, expiresAt]
  );
  return rows[0];
}

async function findForRotation(client, jti) {
  const { rows } = await client.query(`SELECT * FROM auth_refresh_tokens WHERE jti = $1 FOR UPDATE`, [jti]);
  return rows[0] || null;
}

async function revoke(client, jti, replacedByJti) {
  await client.query(`UPDATE auth_refresh_tokens SET revoked_at = now(), replaced_by_jti = $2 WHERE jti = $1 AND revoked_at IS NULL`, [jti, replacedByJti]);
}

async function revokeAllForUser(userId) {
  await pool.query(`UPDATE auth_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

module.exports = { insert, findForRotation, revoke, revokeAllForUser };

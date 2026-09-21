'use strict';

const { pool } = require('../config/db');
const userRepo = require('../repositories/userRepository');
const refreshRepo = require('../repositories/authRefreshRepository');
const { hashPassword, verifyPassword } = require('../utils/password');
const { hashToken } = require('../utils/tokenHash');
const { signAccessToken, signRefreshToken, verifyRefreshToken, newRefreshJti, REFRESH_TTL_SECONDS } = require('../utils/jwt');

class AuthError extends Error {
  constructor(message, code, status = 401) { super(message); this.code = code; this.status = status; }
}

async function issueTokens(user, client = null) {
  const safeUser = { id: user.id, email: user.email, role: user.role };
  const accessToken = signAccessToken(safeUser);
  const jti = newRefreshJti();
  const refreshToken = signRefreshToken(safeUser, jti);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
  const dbClient = client || pool;
  await refreshRepo.insert(dbClient, { jti, userId: user.id, tokenHash: hashToken(refreshToken), expiresAt });
  return { user: safeUser, accessToken, refreshToken };
}

async function signup({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password || password.length < 8) throw new AuthError('Email and a password of at least 8 characters are required', 'INVALID_INPUT', 400);
  if (await userRepo.findByEmail(normalizedEmail)) throw new AuthError('An account with this email already exists', 'EMAIL_TAKEN', 409);
  try {
    const user = await userRepo.createUser({ email: normalizedEmail, passwordHash: await hashPassword(password) });
    return issueTokens(user);
  } catch (err) {
    if (err.code === '23505') throw new AuthError('An account with this email already exists', 'EMAIL_TAKEN', 409);
    throw err;
  }
}

async function login({ email, password }) {
  const user = await userRepo.findByEmail(String(email || '').trim().toLowerCase());
  if (!user || !(await verifyPassword(password, user.password_hash))) throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  return issueTokens(user);
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new AuthError('Refresh token is required', 'REFRESH_REQUIRED', 401);
  let payload;
  try { payload = verifyRefreshToken(refreshToken); }
  catch { throw new AuthError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN', 401); }
  if (!payload.jti || !payload.sub) throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);

  const user = await userRepo.findById(payload.sub);
  if (!user) throw new AuthError('User no longer exists', 'INVALID_REFRESH_TOKEN', 401);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = await refreshRepo.findForRotation(client, payload.jti);
    if (!row || row.user_id !== user.id || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
      throw new AuthError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN', 401);
    }
    if (hashToken(refreshToken) !== row.token_hash) throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);

    const safeUser = { id: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(safeUser);
    const newJti = newRefreshJti();
    const newToken = signRefreshToken(safeUser, newJti);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    await refreshRepo.insert(client, { jti: newJti, userId: user.id, tokenHash: hashToken(newToken), expiresAt });
    await refreshRepo.revoke(client, row.jti, newJti);
    await client.query('COMMIT');
    return { user: safeUser, accessToken, refreshToken: newToken };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.jti) await pool.query(`UPDATE auth_refresh_tokens SET revoked_at = now() WHERE jti = $1 AND revoked_at IS NULL`, [payload.jti]);
  } catch (_) { /* logout remains idempotent */ }
}

module.exports = { signup, login, refresh, logout, AuthError };


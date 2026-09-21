'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validateProductionEnv } = require('../config/env');
validateProductionEnv();

const ACCESS_SECRET = process.env.JWT_SECRET || 'dev-access-secret-do-not-use-in-prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-do-not-use-in-prod';
const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function newRefreshJti() {
  return crypto.randomUUID();
}

function signRefreshToken(user, jti) {
  return jwt.sign({ sub: user.id, jti }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyAccessToken(token) { return jwt.verify(token, ACCESS_SECRET); }
function verifyRefreshToken(token) { return jwt.verify(token, REFRESH_SECRET); }

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, newRefreshJti, REFRESH_TTL_SECONDS };

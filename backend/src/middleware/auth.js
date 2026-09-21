'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const userRepo = require('../repositories/userRepository');

/**
 * Establishes req.user from a verified access token. Identity NEVER comes
 * from a request body/param — only from this token. Re-fetches the user
 * from the DB (not just trusting the token's role claim) so a role change
 * takes effect immediately rather than waiting for token expiry — see
 * ARCHITECTURE_DECISIONS.md Section H.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await userRepo.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = user; // { id, email, role, created_at } — the ONLY source of identity downstream
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role check — always applied AFTER requireAuth, always against the
 * DB-sourced req.user, never against a client-supplied field.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

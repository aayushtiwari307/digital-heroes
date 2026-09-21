'use strict';

const buckets = new Map();
const CLEANUP_MS = 10 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.resetAt <= now) buckets.delete(key);
}, CLEANUP_MS);
cleanupTimer.unref?.();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 30, name = 'request' } = {}) {
  return (req, res, next) => {
    if ((process.env.NODE_ENV || 'development') === 'test' && process.env.TEST_RATE_LIMITS !== '1') return next();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${name}:${ip}`;
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED' });
    }
    return next();
  };
}

module.exports = { rateLimit };

'use strict';

const REQUIRED_PRODUCTION = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'FRONTEND_URL',
];

function validateProductionEnv(env = process.env) {
  if ((env.NODE_ENV || 'development') !== 'production') return;
  const missing = REQUIRED_PRODUCTION.filter((key) => !env[key] || !String(env[key]).trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

function frontendOrigin(env = process.env) {
  const configured = env.FRONTEND_URL && String(env.FRONTEND_URL).trim();
  if (configured) return configured.replace(/\/$/, '');
  if ((env.NODE_ENV || 'development') === 'production') {
    throw new Error('FRONTEND_URL is required in production');
  }
  return 'http://localhost:5173';
}

module.exports = { REQUIRED_PRODUCTION, validateProductionEnv, frontendOrigin };

'use strict';

const Stripe = require('stripe');
const { validateProductionEnv } = require('./env');
validateProductionEnv();

const key = process.env.STRIPE_SECRET_KEY || 'sk_test_dev_only_replace_me';
const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

module.exports = { stripe };

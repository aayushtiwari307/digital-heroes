'use strict';
const subscriptionRepo = require('../repositories/subscriptionRepository');

async function requireEntitledSubscription(req, res, next) {
  try {
    const subscription = await subscriptionRepo.findEntitledByUser(req.user.id);
    if (!subscription) {
      return res.status(403).json({ error: 'An active subscription is required for score changes', code: 'SUBSCRIPTION_REQUIRED' });
    }
    req.subscription = subscription;
    next();
  } catch (err) { next(err); }
}

module.exports = { requireEntitledSubscription };

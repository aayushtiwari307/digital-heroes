-- Needed for ON CONFLICT upsert from the checkout.session.completed /
-- customer.subscription.* webhook handlers to be safely re-runnable.
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

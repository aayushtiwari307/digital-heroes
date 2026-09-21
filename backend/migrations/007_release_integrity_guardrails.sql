-- Digital Heroes release integrity guardrails.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='subscriptions_allocation_pct_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_allocation_pct_check
      CHECK (charity_pct + pool_pct_snapshot <= 100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='charity_contributions_allocation_pct_check'
  ) THEN
    ALTER TABLE charity_contributions
      ADD CONSTRAINT charity_contributions_allocation_pct_check
      CHECK (charity_pct + pool_pct <= 100);
  END IF;
END $$;

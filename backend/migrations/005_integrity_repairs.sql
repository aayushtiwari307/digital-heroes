-- Digital Heroes CTO integrity repairs.
-- This migration upgrades the scaffold without changing the locked stack.

ALTER TABLE charities
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE charities DROP CONSTRAINT IF EXISTS charities_min_pct_check;
ALTER TABLE charities ADD CONSTRAINT charities_min_pct_check CHECK (min_pct >= 10 AND min_pct <= 100);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS pool_pct_snapshot INTEGER;
UPDATE subscriptions SET pool_pct_snapshot = COALESCE(pool_pct_snapshot, 20);
ALTER TABLE subscriptions ALTER COLUMN pool_pct_snapshot SET DEFAULT 20;
ALTER TABLE subscriptions ALTER COLUMN pool_pct_snapshot SET NOT NULL;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_pool_pct_snapshot_check CHECK (pool_pct_snapshot BETWEEN 0 AND 100);
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_charity_pct_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_charity_pct_check CHECK (charity_pct >= 10 AND charity_pct <= 100);

DROP INDEX IF EXISTS idx_subscriptions_one_active;
CREATE UNIQUE INDEX idx_subscriptions_one_active
  ON subscriptions (user_id) WHERE status = 'active';

ALTER TABLE charity_contributions
  ADD COLUMN IF NOT EXISTS allocation_basis TEXT NOT NULL DEFAULT 'stripe_invoice',
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_charity_contributions_subscription_period
  ON charity_contributions (subscription_id, billing_period);
ALTER TABLE charity_contributions DROP CONSTRAINT IF EXISTS charity_contributions_charity_pct_check;
ALTER TABLE charity_contributions ADD CONSTRAINT charity_contributions_charity_pct_check CHECK (charity_pct >= 10 AND charity_pct <= 100);
ALTER TABLE charity_contributions DROP CONSTRAINT IF EXISTS charity_contributions_pool_pct_check;
ALTER TABLE charity_contributions ADD CONSTRAINT charity_contributions_pool_pct_check CHECK (pool_pct >= 0 AND pool_pct <= 100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_charity_contributions_stripe_invoice
  ON charity_contributions (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS score_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id UUID,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('inserted', 'updated', 'deleted', 'evicted')),
  score_date DATE,
  value INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  jti UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_jti UUID REFERENCES auth_refresh_tokens(jti),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expiry ON auth_refresh_tokens(expires_at);

ALTER TABLE draws
  ADD COLUMN IF NOT EXISTS seed TEXT,
  ADD COLUMN IF NOT EXISTS config_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT NOT NULL DEFAULT 'seeded-prng-v1',
  ADD COLUMN IF NOT EXISTS snapshot_hash TEXT;
ALTER TABLE draws DROP COLUMN IF EXISTS general_reserve_in;
ALTER TABLE draws DROP COLUMN IF EXISTS general_reserve_out;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_draw_per_month_for_simulation
  ON draws(month) WHERE status IN ('draft','simulated');

DROP TABLE IF EXISTS draw_snapshots CASCADE;
ALTER TABLE draw_entries ADD COLUMN IF NOT EXISTS score_dates DATE[] NOT NULL DEFAULT ARRAY[]::DATE[];
ALTER TABLE draw_entries DROP CONSTRAINT IF EXISTS draw_entries_ticket_valid;
ALTER TABLE draw_entries ADD CONSTRAINT draw_entries_ticket_valid
  CHECK (cardinality(ticket_numbers) BETWEEN 1 AND 5
         AND cardinality(score_dates) = 5);
CREATE UNIQUE INDEX IF NOT EXISTS idx_draw_entries_draw_user ON draw_entries(draw_id, user_id);

ALTER TABLE winners ADD COLUMN IF NOT EXISTS draw_entry_id UUID;
ALTER TABLE winners DROP CONSTRAINT IF EXISTS winners_draw_entry_id_fkey;
ALTER TABLE draw_entries ADD CONSTRAINT draw_entries_draw_user_unique UNIQUE (draw_id, user_id);
UPDATE winners w
SET draw_entry_id = e.id
FROM draw_entries e
WHERE e.draw_id = w.draw_id AND e.user_id = w.user_id AND w.draw_entry_id IS NULL;
ALTER TABLE winners ALTER COLUMN draw_entry_id SET NOT NULL;
ALTER TABLE winners ADD CONSTRAINT winners_draw_entry_fk
  FOREIGN KEY (draw_entry_id) REFERENCES draw_entries(id);
ALTER TABLE winners ADD CONSTRAINT winners_draw_user_entry_fk
  FOREIGN KEY (draw_id, user_id) REFERENCES draw_entries(draw_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_winner_per_draw_user ON winners(draw_id, user_id);

ALTER TABLE winner_proofs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE winner_proofs ADD COLUMN IF NOT EXISTS version_no INTEGER;
UPDATE winner_proofs wp
SET user_id = w.user_id
FROM winners w
WHERE wp.winner_id = w.id AND wp.user_id IS NULL;
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY winner_id ORDER BY created_at, id) AS rn
  FROM winner_proofs
)
UPDATE winner_proofs wp
SET version_no = numbered.rn
FROM numbered
WHERE numbered.id = wp.id AND wp.version_no IS NULL;
ALTER TABLE winner_proofs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE winner_proofs ALTER COLUMN version_no SET NOT NULL;
ALTER TABLE winner_proofs ADD CONSTRAINT winner_proofs_version_positive CHECK (version_no >= 1);
ALTER TABLE winners ADD CONSTRAINT winners_id_user_unique UNIQUE (id, user_id);
ALTER TABLE winner_proofs ADD CONSTRAINT winner_proof_winner_user_fk
  FOREIGN KEY (winner_id, user_id) REFERENCES winners(id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_winner_proof_version ON winner_proofs(winner_id, version_no);

CREATE OR REPLACE FUNCTION protect_winner_proof_state()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.winner_id <> NEW.winner_id
     OR OLD.user_id <> NEW.user_id
     OR OLD.version_no <> NEW.version_no
     OR OLD.storage_path <> NEW.storage_path THEN
    RAISE EXCEPTION 'Winner proof identity and storage are immutable' USING ERRCODE = '55000';
  END IF;
  IF OLD.status <> 'pending' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Reviewed proof status cannot be changed' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_winner_proof_state ON winner_proofs;
CREATE TRIGGER trg_winner_proof_state
BEFORE UPDATE ON winner_proofs
FOR EACH ROW EXECUTE FUNCTION protect_winner_proof_state();

CREATE OR REPLACE FUNCTION prevent_published_draw_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      RAISE EXCEPTION 'Published draws cannot be deleted' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Published draws are immutable' USING ERRCODE = '55000';
  END IF;

  IF NEW.status = 'published' THEN
    IF NEW.month <> OLD.month
       OR NEW.strategy <> OLD.strategy
       OR COALESCE(NEW.seed, '') <> COALESCE(OLD.seed, '')
       OR COALESCE(NEW.config_version, '') <> COALESCE(OLD.config_version, '')
       OR COALESCE(NEW.algorithm_version, '') <> COALESCE(OLD.algorithm_version, '')
       OR COALESCE(NEW.snapshot_hash, '') <> COALESCE(OLD.snapshot_hash, '')
       OR NEW.total_pool_minor <> OLD.total_pool_minor
       OR NEW.jackpot_carry_in <> OLD.jackpot_carry_in
       OR NEW.jackpot_carry_out <> OLD.jackpot_carry_out
       OR NEW.unawarded_minor <> OLD.unawarded_minor THEN
      RAISE EXCEPTION 'Protected draw fields cannot change on publish' USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_draws_immutable ON draws;
CREATE TRIGGER trg_draws_immutable
BEFORE UPDATE OR DELETE ON draws
FOR EACH ROW EXECUTE FUNCTION prevent_published_draw_mutation();

CREATE OR REPLACE FUNCTION prevent_published_draw_child_mutation()
RETURNS TRIGGER AS $$
DECLARE draw_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'draw_entries' THEN
    SELECT status INTO draw_status FROM draws WHERE id = COALESCE(NEW.draw_id, OLD.draw_id);
  ELSE
    SELECT status INTO draw_status FROM draws WHERE id = COALESCE(NEW.draw_id, OLD.draw_id);
  END IF;
  IF draw_status = 'published' THEN
    RAISE EXCEPTION 'Published draw data is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_draw_entries_immutable ON draw_entries;
CREATE TRIGGER trg_draw_entries_immutable
BEFORE INSERT OR UPDATE OR DELETE ON draw_entries
FOR EACH ROW EXECUTE FUNCTION prevent_published_draw_child_mutation();

DROP TRIGGER IF EXISTS trg_draw_results_immutable ON draw_results;
CREATE TRIGGER trg_draw_results_immutable
BEFORE INSERT OR UPDATE OR DELETE ON draw_results
FOR EACH ROW EXECUTE FUNCTION prevent_published_draw_child_mutation();

CREATE OR REPLACE FUNCTION protect_winner_state()
RETURNS TRIGGER AS $$
DECLARE draw_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO draw_status FROM draws WHERE id = OLD.draw_id;
    IF draw_status = 'published' THEN
      RAISE EXCEPTION 'Winners for published draws cannot be deleted' USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.draw_id <> NEW.draw_id
     OR OLD.draw_entry_id <> NEW.draw_entry_id
     OR OLD.user_id <> NEW.user_id
     OR OLD.tier <> NEW.tier
     OR OLD.payout_minor <> NEW.payout_minor THEN
    RAISE EXCEPTION 'Winner identity and payout are immutable' USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'Paid winners cannot move backwards' USING ERRCODE = '55000';
  END IF;
  IF OLD.status = 'pending' AND NEW.status NOT IN ('pending','paid') THEN
    RAISE EXCEPTION 'Invalid winner state transition' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_winners_state ON winners;
CREATE TRIGGER trg_winners_state
BEFORE UPDATE OR DELETE ON winners
FOR EACH ROW EXECUTE FUNCTION protect_winner_state();

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Financial ledger rows are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_charity_contributions_immutable ON charity_contributions;
CREATE TRIGGER trg_charity_contributions_immutable
BEFORE UPDATE OR DELETE ON charity_contributions
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

-- Defensive migration cleanup for old reserve columns if they exist.
ALTER TABLE draws DROP COLUMN IF EXISTS general_reserve_in;
ALTER TABLE draws DROP COLUMN IF EXISTS general_reserve_out;

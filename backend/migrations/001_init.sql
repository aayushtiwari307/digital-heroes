-- Digital Heroes — initial schema
-- Money is stored in integer minor units (paise) throughout.
-- Append-only tables are marked; the app layer must never UPDATE them in place.

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'subscriber' CHECK (role IN ('subscriber', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  interval    TEXT NOT NULL CHECK (interval IN ('month', 'year')),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency    TEXT NOT NULL DEFAULT 'INR'
);

CREATE TABLE charities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  min_pct     INTEGER NOT NULL DEFAULT 10 CHECK (min_pct >= 0 AND min_pct <= 100),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE charity_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charity_id  UUID NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  event_date  DATE,
  description TEXT
);

CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                UUID NOT NULL REFERENCES plans(id),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  status                 TEXT NOT NULL CHECK (status IN ('active', 'lapsed', 'cancelled')),
  charity_id             UUID REFERENCES charities(id),
  charity_pct            INTEGER NOT NULL CHECK (charity_pct >= 0 AND charity_pct <= 100),
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only lifecycle history (renewals, cancellations, resubscriptions).
CREATE TABLE subscription_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot        JSONB NOT NULL
);

CREATE TABLE scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL,
  value      INTEGER NOT NULL CHECK (value BETWEEN 1 AND 45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, score_date)
);
CREATE INDEX idx_scores_user_date ON scores (user_id, score_date DESC);

-- Immutable per-billing-period ledger — the real financial record of what went where.
CREATE TABLE charity_contributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  billing_period  TEXT NOT NULL, -- e.g. '2026-09'
  gross_minor     INTEGER NOT NULL CHECK (gross_minor >= 0),
  charity_minor   INTEGER NOT NULL CHECK (charity_minor >= 0),
  pool_minor      INTEGER NOT NULL CHECK (pool_minor >= 0),
  charity_id      UUID NOT NULL REFERENCES charities(id),
  charity_pct     INTEGER NOT NULL,
  pool_pct        INTEGER NOT NULL, -- snapshot of platform_settings.pool_contribution_pct at the time
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin-editable demo/config values. pool_contribution_pct is explicitly an
-- IMPLEMENTATION CHOICE — see ARCHITECTURE_DECISIONS.md table M, row 1.
CREATE TABLE platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (key, value) VALUES
  ('pool_contribution_pct', '20'),   -- % of subscription fee that funds the prize pool (DEMO DEFAULT, admin-editable)
  ('tier_shares', '{"5": 40, "4": 35, "3": 25}');  -- PRD fact, fixed

CREATE TABLE draws (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month        TEXT NOT NULL, -- '2026-09'
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'simulated', 'published')),
  strategy     TEXT NOT NULL CHECK (strategy IN ('random', 'algorithmic')),
  published_at TIMESTAMPTZ
);
-- Only one PUBLISHED draw per month — the core anti-duplicate-publish guard.
CREATE UNIQUE INDEX idx_one_published_draw_per_month
  ON draws (month) WHERE status = 'published';

-- Frozen input state — what the draw was computed from. Append-only.
CREATE TABLE draw_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id          UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  eligible_users   JSONB NOT NULL,
  config_version   TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  snapshot_hash    TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Frozen ticket per user for that draw — never recomputed live after snapshot.
CREATE TABLE draw_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id        UUID NOT NULL REFERENCES draws(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id),
  ticket_numbers INTEGER[] NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (draw_id, user_id)
);

CREATE TABLE draw_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id         UUID NOT NULL UNIQUE REFERENCES draws(id) ON DELETE CASCADE,
  winning_numbers INTEGER[] NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE winners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id      UUID NOT NULL REFERENCES draws(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  tier         INTEGER NOT NULL CHECK (tier IN (3, 4, 5)),
  payout_minor INTEGER NOT NULL CHECK (payout_minor >= 0),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE winner_proofs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id     UUID NOT NULL REFERENCES winners(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stripe webhook idempotency guard.
CREATE TABLE stripe_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     TEXT UNIQUE NOT NULL,
  type         TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id   UUID,
  before      JSONB,
  after       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

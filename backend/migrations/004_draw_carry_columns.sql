-- Draw financial bookkeeping. Lower-tier carry is intentionally absent:
-- only the unclaimed 5-match jackpot may roll forward.
ALTER TABLE draws
  ADD COLUMN IF NOT EXISTS total_pool_minor INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jackpot_carry_in INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jackpot_carry_out INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unawarded_minor INTEGER NOT NULL DEFAULT 0;

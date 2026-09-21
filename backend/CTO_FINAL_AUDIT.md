# Digital Heroes — CTO Final Backend Audit

Date: 21 September 2026

## Decision

**NOT FRONTEND-READY**

The requested P0/P1 repair work has been implemented in the submitted backend scaffold, but the mandatory full Jest/API/PostgreSQL execution gate could not be completed in this environment. I will not convert code-level confidence into a false "frontend-ready" claim.

## 1. Files changed

### Configuration / startup / security
- `src/config/env.js`
- `src/config/db.js`
- `src/config/stripe.js`
- `src/config/supabaseStorage.js`
- `src/config/migrate.js`
- `src/server.js`
- `src/app.js`
- `src/middleware/auth.js`
- `src/middleware/entitlement.js`
- `src/middleware/optionalAuth.js`
- `src/middleware/rateLimit.js`
- `src/middleware/errorHandler.js`
- `src/utils/jwt.js`
- `src/utils/tokenHash.js`
- `src/utils/imageValidation.js`

### Auth / subscriptions / scoring / draw / winners / charities
- `src/services/authService.js`
- `src/controllers/authController.js`
- `src/routes/auth.js`
- `src/repositories/authRefreshRepository.js`
- `src/services/subscriptionService.js`
- `src/controllers/subscriptionController.js`
- `src/routes/subscriptions.js`
- `src/repositories/subscriptionRepository.js`
- `src/services/scoreService.js`
- `src/repositories/scoreRepository.js`
- `src/routes/scores.js`
- `src/domain/scoreRules.js`
- `src/domain/drawEngine.js`
- `src/domain/prizeEngine.js`
- `src/services/drawService.js`
- `src/repositories/drawRepository.js`
- `src/controllers/drawController.js`
- `src/routes/draws.js`
- `src/services/winnerService.js`
- `src/repositories/winnerRepository.js`
- `src/controllers/winnerController.js`
- `src/controllers/adminWinnerController.js`
- `src/routes/winners.js`
- `src/routes/adminWinners.js`
- `src/services/charityService.js`
- `src/repositories/charityRepository.js`
- `src/controllers/charityController.js`
- `src/controllers/adminCharityController.js`
- `src/routes/charities.js`
- `src/routes/adminCharities.js`

### Admin / API completeness
- `src/repositories/adminRepository.js`
- `src/controllers/adminController.js`
- `src/routes/admin.js`

### Tests / verification
- `src/domain/__tests__/drawEngine.test.js`
- `src/domain/__tests__/prizeEngine.test.js`
- `src/domain/__tests__/scoreRules.test.js`
- `src/middleware/__tests__/rateLimit.test.js`
- `src/utils/__tests__/imageValidation.test.js`
- `tests/integration/admin.test.js`
- `tests/integration/auth.test.js`
- `tests/integration/charities.test.js`
- `tests/integration/draws.test.js`
- `tests/integration/integrity.test.js`
- `tests/integration/scores.test.js`
- `tests/integration/setup.js`
- `tests/integration/subscriptions.test.js`
- `tests/integration/webhooks.test.js`
- `tests/integration/winners.test.js`
- `scripts/cto_static_audit.js`
- `scripts/cto_domain_smoke.js`

## 2. Migrations changed / added

- `migrations/004_draw_carry_columns.sql` — jackpot-only carry fields; no lower-tier reserve.
- `migrations/005_integrity_repairs.sql` — retention audit, refresh tokens, subscription uniqueness/snapshots, Stripe ledger references, draw seeds/hash/immutability triggers, draw-entry integrity, winner/proof constraints, charity minimum/deactivation, and legacy schema cleanup.
- `migrations/006_charity_media.sql` — charity media records.

The original `001_init.sql` still contains the historical scaffold definitions for compatibility; the ordered migration chain converts those definitions to the final schema before application use.

## 3. API changes

Added or completed:
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/subscriptions/plans`
- `POST /api/subscriptions/cancel`
- `GET /api/draws`
- `GET /api/draws/:id`
- comprehensive admin user/profile/role/score/subscription/report/config routes
- admin charity events/media routes
- existing draw simulation/publish and winner verification/payout paths were repaired rather than redesigned.

## 4. Auth changes

- Access tokens: 15 minute JWT.
- Refresh tokens: 7 day JWT with JTI.
- Refresh JTI, token hash, expiry, revocation and replacement are persisted.
- Refresh is rotated transactionally; reused/revoked refresh tokens return 401.
- Role is re-read from the database by `requireAuth`.
- Signup/login/refresh are rate limited.
- Production secrets fail startup when missing.

## 5. Stripe changes

- `invoice.paid` is handled for successful billing periods.
- Stripe-supplied period timestamps are used instead of local `new Date()` period derivation.
- Financial allocation is an immutable ledger entry.
- `(subscription_id, billing_period)` prevents duplicate period allocation.
- Stripe invoice references are stored and indexed for idempotency.
- Annual subscriptions use the documented annual-price/12 monthly-equivalent policy for entitled draw months.
- Admin cancellation calls Stripe first; the local status is changed by verified webhook state.
- Webhook event IDs remain transactionally idempotent.

## 6. Score changes

- Persisted `scores` is authoritative and capped at five retained records per user.
- Insert/edit/delete operations take a user-scoped PostgreSQL advisory transaction lock.
- After mutation, only the five newest dates remain in `scores`.
- Evictions and mutations are recorded in `score_audit`.
- One score per date and values 1–45 remain DB-enforced.
- POST/PUT/DELETE score routes require an entitled subscription.

## 7. Draw changes

- Server-generated seed persisted on each simulation.
- Algorithm version and config version persisted.
- SHA-256 snapshot hash is persisted.
- Authoritative draw generation no longer defaults to `Math.random()`.
- Random and weighted strategies use a deterministic seeded PRNG.
- Exactly five winning values are generated, without replacement, in the 1–45 range.
- `draw_entries` is the authoritative frozen participant state; the competing `draw_snapshots` dependency was removed by migration.
- Published draw rows, entries, and results are protected by PostgreSQL triggers.
- Subscriber/public draw endpoints expose only published/public data and authenticated users' own entry/winnings.

## 8. Prize changes

- Tier shares are fixed at 40% / 35% / 25% for 5 / 4 / 3 matches.
- Only unclaimed 5-match value rolls into the next jackpot.
- Unclaimed 4-match and 3-match amounts are recorded as `unawarded_minor` and are not reused in later prize pools.
- Integer split remainders are explicit; only 5-tier remainder stays within the permitted jackpot carry.
- A conservation check aborts an invalid draw calculation.

## 9. Winner changes

- Every winner references a specific `draw_entry`.
- Composite DB integrity ties `winner.draw_id/user_id` to the same draw entry.
- Winner identity and payout are immutable after creation.
- Published-draw winners cannot be deleted.
- Proofs carry `winner_id`, owner `user_id`, version number and storage path.
- Proof resubmission creates a new version; dashboard queries use only the latest version to avoid duplicate winner rows.
- PNG/JPEG/WEBP proof uploads are limited to 5MB and checked against magic bytes plus declared MIME type.
- Paid winners cannot regress or receive another proof/review workflow change.

## 10. Security changes

- Production environment fails closed for all required secrets.
- CORS is an allowlist, not origin reflection/wildcard behavior.
- JWT role is not trusted from the client.
- Score, winner and proof routes are ownership-scoped.
- Auth endpoints have rate limiting.
- Supabase winner-proof bucket remains private with short-lived signed URLs.
- Charity minimum percentage is enforced in service logic and PostgreSQL.

## 11. Tests added/repaired

The repaired Jest suite contains 14 `.test.js` files and approximately 100 `test()` cases. Coverage additions include:
- 5-tier-only rollover rules
- seeded draw reproducibility
- refresh rotation/reuse rejection
- latest-five storage behavior
- subscription score gating
- Stripe invoice idempotency/renewal allocation
- annual monthly-equivalent funding
- published-draw DB immutability
- winner/draw-entry composite integrity
- winner proof versioning and duplicate-dashboard protection
- 5MB proof rejection and content validation
- charity soft-delete behavior
- admin Stripe cancellation ordering
- auth rate limiter behavior

## 12. Actual checks passed

- `node scripts/cto_domain_smoke.js` → `CTO_DOMAIN_SMOKE_OK`
- `node scripts/cto_static_audit.js` → `CTO_STATIC_AUDIT_OK (58 src files, 14 test files, 6 migrations)`
- `node --check` on every JS file under `src`, `tests`, and `scripts` → `FINAL_STATIC_SYNTAX_OK`
- production environment fail-closed check → `PROD_ENV_FAILCLOSED_OK`
- local `require()` reference scan is included in `cto_static_audit.js` and passed.

## 13. Tests not executable in this audit environment

- `npm install --no-audit --no-fund` — transport timeout; installation did not complete.
- `npm test` — `jest: not found` (exit 127) because dependencies were unavailable.
- `npm test -- --runInBand` — `jest: not found` (exit 127).
- `npm run typecheck` — no script configured.
- `npm run lint` — no script configured.
- Real PostgreSQL migration/integration execution — not available; no PostgreSQL server/client was present.
- Live Stripe API execution — not performed; integration coverage mocks only the external Stripe call where required.
- Live Supabase Storage execution — not performed; integration coverage mocks the external storage call where required.

## 14. Known limitations

1. The environment prevented the mandatory dependency install and real PostgreSQL execution. This is the sole reason the readiness gate remains closed in this audit.
2. The annual monthly-equivalent allocation is an explicitly documented interpretation of an under-specified PRD area; the exact basis is stored per ledger row.
3. Rate limiting is process-local and intentionally has no Redis/distributed-state dependency, matching the locked stack.
4. Proof file validation is magic-byte validation, not full image decoding/OCR.
5. The PRD's supplied PDF omits Sections 13 and 14; no requirements were invented from that missing material.

## 15. Final backend readiness

Code-level repair status: **P0/P1 implementation complete to the inspected scope.**

Execution gate: **OPEN ITEMS remain because Jest/PostgreSQL could not run in this environment.**

No frontend work should begin based on this audit result. Run `npm install`, then `npm test -- --runInBand`, then the real PostgreSQL migration/integration tests in the deployment/test environment. Only after those pass should the backend be reclassified as frontend-ready.

NOT FRONTEND-READY

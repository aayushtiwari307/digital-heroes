'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function filesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const srcFiles = filesUnder(path.join(root, 'src')).filter((f) => f.endsWith('.js'));
const testFiles = filesUnder(root).filter((f) => f.endsWith('.test.js'));
const migrations = filesUnder(path.join(root, 'migrations')).filter((f) => f.endsWith('.sql'));
const read = (file) => fs.readFileSync(file, 'utf8');
const srcText = srcFiles.map(read).join('\n');
const testText = testFiles.map(read).join('\n');
const migrationText = migrations.map(read).join('\n');

const failures = [];
function assert(condition, message) { if (!condition) failures.push(message); }

assert(!/Math\.random\s*\(/.test(srcText), 'authoritative source still calls Math.random()');
assert(/drawRandomNumbers\(rng\)/.test(srcText), 'draw engine RNG seam missing');
assert(/A seeded RNG is required/.test(srcText), 'draw engine does not fail closed without seeded RNG');
assert(/invoice\.paid/.test(srcText), 'invoice.paid handler missing');
assert(/annual-monthly-equivalent/.test(srcText), 'annual monthly-equivalent allocation missing');
assert(/stripe_invoice_id/.test(migrationText), 'Stripe invoice reference column missing from migrations');
assert(/auth_refresh_tokens/.test(migrationText) && /replaced_by_jti/.test(migrationText), 'refresh-token lifecycle table missing rotation state');
assert(/POST|post/.test(read(path.join(root, 'src/routes/auth.js'))) && /\/refresh/.test(read(path.join(root, 'src/routes/auth.js'))), 'refresh route missing');
assert(/requireEntitledSubscription/.test(read(path.join(root, 'src/routes/scores.js'))), 'score entitlement middleware missing');
assert(/s\.status='active'/.test(read(path.join(root, 'src/repositories/drawRepository.js'))), 'draw active-subscription eligibility query missing');
assert(/OFFSET 5/.test(read(path.join(root, 'src/repositories/scoreRepository.js'))), 'latest-five retention trim missing');
assert(/CREATE UNIQUE INDEX idx_subscriptions_one_active/.test(migrationText), 'one-active-subscription index missing');
assert(/trg_draws_immutable/.test(migrationText) && /trg_draw_entries_immutable/.test(migrationText) && /trg_draw_results_immutable/.test(migrationText), 'published-draw DB immutability triggers missing');
assert(/winners_draw_user_entry_fk/.test(migrationText), 'winner composite draw/user-entry FK missing');
assert(/trg_winner_proof_state/.test(migrationText), 'winner proof ownership/state trigger missing');
assert(/is_active BOOLEAN/.test(migrationText) && /min_pct >= 10/.test(migrationText), 'charity soft-delete/minimum constraint missing');
assert(/allowedOrigin/.test(read(path.join(root, 'src/app.js'))) && /origin===prod/.test(read(path.join(root, 'src/app.js'))), 'strict CORS allowlist missing');
assert(/rateLimit/.test(read(path.join(root, 'src/routes/auth.js'))), 'auth rate limiting missing');
assert(/Missing required production environment variables/.test(read(path.join(root, 'src/config/env.js'))), 'production fail-closed env validation missing');
assert(/totalPrizePoolFunding/.test(read(path.join(root, 'src/repositories/adminRepository.js'))) && /totalPayouts/.test(read(path.join(root, 'src/repositories/adminRepository.js'))), 'reporting fields are not separated');
assert(/listPublishedDraws/.test(read(path.join(root, 'src/repositories/drawRepository.js'))) && /findPublicDraw/.test(read(path.join(root, 'src/repositories/drawRepository.js'))), 'subscriber/public draw read endpoints missing');
assert(/general_reserve/.test(migrationText), 'expected legacy reserve column cleanup is missing');
assert(!/general_reserve/.test(srcText), 'general reserve behavior remains in source');
assert(!/draw_snapshots/.test(srcText), 'draw_snapshots remains an active source dependency');
assert(!srcText.includes('totalPrizePayouts'), 'old report metric remains in backend source');
assert(!srcText.includes('recentDraws'), 'old recentDraws metric remains in backend source');
assert(testFiles.length >= 14, `unexpectedly small Jest test suite footprint: ${testFiles.length} test files`);

// Ensure every local require resolves to an existing JS/module entry point.
for (const file of srcFiles) {
  const text = read(file);
  for (const match of text.matchAll(/require\(['"](\.\.?\/[^'"]+)['"]\)/g)) {
    const requested = path.resolve(path.dirname(file), match[1]);
    const candidates = [requested, `${requested}.js`, path.join(requested, 'index.js')];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      failures.push(`missing local module: ${path.relative(root, file)} -> ${match[1]}`);
    }
  }
}

if (failures.length) {
  console.error('CTO_STATIC_AUDIT_FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`CTO_STATIC_AUDIT_OK (${srcFiles.length} src files, ${testFiles.length} test files, ${migrations.length} migrations)`);

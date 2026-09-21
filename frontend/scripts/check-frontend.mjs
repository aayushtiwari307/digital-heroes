import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const failures = [];
const extensions = ['.js', '.jsx', '.json', '.css'];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

const files = walk(src);
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  if (/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|JWT_SECRET|sk_live_|whsec_[A-Za-z0-9]+/.test(text)) failures.push(`${rel}: possible secret material found`);
  const imports = [...text.matchAll(/(?:from\s+|import\(\s*)['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of imports) {
    const base = path.resolve(path.dirname(file), spec);
    const candidates = [base, ...extensions.map((ext) => `${base}${ext}`), ...extensions.map((ext) => path.join(base, `index${ext}`))];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) failures.push(`${rel}: missing relative import ${spec}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const script of ['dev', 'build', 'check']) if (!packageJson.scripts?.[script]) failures.push(`package.json: missing ${script} script`);
if (fs.existsSync(path.join(root, 'FRONTEND_QA_REPORT.md'))) failures.push('stale FRONTEND_QA_REPORT.md still exists');
if (!fs.existsSync(path.join(root, 'vercel.json'))) failures.push('vercel.json is missing');
if (!fs.existsSync(path.join(root, 'package-lock.json'))) failures.push('package-lock.json is missing');

const sourceText = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const client = fs.readFileSync(path.join(src, 'api/client.js'), 'utf8');
if (client.includes("headers: { 'Content-Type': 'application/json' }")) failures.push('api/client.js: global JSON content type can break FormData uploads');
if (/alert\s*\(/.test(sourceText)) failures.push('source: blocking alert() calls remain');
if (!client.includes("import.meta.env.PROD && !rawApiUrl")) failures.push('api/client.js: production API URL guard missing');

if (failures.length) {
  console.error('FRONTEND_CHECK_FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`FRONTEND_CHECK_OK (${files.length} source/config files inspected)`);

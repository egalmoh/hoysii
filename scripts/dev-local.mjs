// Starts the real API and management apps. All storage and mail stay local.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const api = new URL('../services/api/', import.meta.url);
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('From the repository root:\n  node scripts/dev-local.mjs --setup    Prepare local D1/R2 and hotel catalog\n  node scripts/dev-local.mjs            Start API, admin and partners\n  node scripts/dev-local.mjs --api-only  Start only the API\n\nSee docs/LOCAL_DEVELOPMENT.md. No remote services are changed.');
  process.exit(0);
}
if (args.length > 1 || args.some(arg => !['--setup', '--api-only'].includes(arg))) {
  throw new Error('Use node scripts/dev-local.mjs [--setup | --api-only].');
}
async function envFile(url) {
  try { return parseEnv(await readFile(url, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
const original = await envFile(new URL('.dev.vars', api));
const saved = await envFile(new URL('.env.development.local', api));
const values = { ...original, ...saved };
const secrets = Object.fromEntries(['BETTER_AUTH_SECRET', 'ADMIN_AUTH_SECRET', 'PARTNER_AUTH_SECRET'].map(key => [key,
  values[key]?.length >= 32 && !values[key].startsWith('replace-') ? values[key] : randomBytes(32).toString('hex'),
]));
if (new Set(Object.values(secrets)).size !== 3) throw new Error('Local auth secrets must be different for each account type.');
const config = {
  ...secrets,
  ADMIN_EMAIL: values.ADMIN_EMAIL || 'admin@example.com',
  BETTER_AUTH_URL: 'http://localhost:8787',
  ADMIN_PANEL_URL: 'http://localhost:3000',
  PARTNER_PANEL_URL: 'http://localhost:3001',
  PARTNER_LOCAL_ORIGINS: 'http://localhost:3001',
  TRUSTED_ORIGINS: 'http://localhost:3000,http://localhost:3001,http://localhost:8081,hoysii://',
  STAKEHOLDER_TESTING: 'true',
};
// A separate ignored env file preserves the owner's .dev.vars and production config.
await writeFile(new URL('.env.development.local', api), Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
const processEnv = { ...process.env, WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false' };
const wrangler = fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js', api));
const apiDir = fileURLToPath(api);
function run(command, commandArgs, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd, env: processEnv, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Local setup command failed (${code}).`)));
  });
}
if (args.includes('--setup')) {
  await run(process.execPath, [wrangler, 'd1', 'migrations', 'apply', 'hoysii', '--local'], apiDir);
  await run(process.execPath, ['scripts/import-stakeholder-hotels.mjs', '--local'], apiDir);
  console.log('\nLocal setup complete. Start with: node scripts/dev-local.mjs');
  process.exit(0);
}
const ports = args.includes('--api-only') ? [8787] : [8787, 3000, 3001];
for (const port of ports) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => reject(new Error(error.code === 'EADDRINUSE'
      ? `Port ${port} is already in use. Stop that local server and rerun.`
      : `Cannot listen on localhost:${port} (${error.code}). Allow local networking and rerun.`, { cause: error })));
    server.listen(port, 'localhost', () => server.close(resolve));
  });
}
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
function start(command, commandArgs, cwd, env = {}) {
  const child = spawn(command, commandArgs, { cwd, env: { ...processEnv, ...env }, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 1); });
}
start(process.execPath, [wrangler, 'dev', '--local', '--ip', 'localhost', '--port', '8787', '--env-file', '.env.development.local'], apiDir);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
// Start the websites only after the real Worker is ready for their session requests.
let apiReady = false;
for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
  try {
    const response = await fetch('http://localhost:8787/v1/config', { signal: AbortSignal.timeout(1000) });
    if (response.ok) { apiReady = true; break; }
  } catch { /* Wrangler is still starting. */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!apiReady) {
  if (!stopping) { console.error('The local API did not become ready. Check the Wrangler error above.'); stop(1); }
} else {
  if (!args.includes('--api-only')) {
    for (const [name, port] of [['admin', 3000], ['partners', 3001]]) {
      const cwd = `${root}apps/${name}`;
      start(process.execPath, [`${cwd}/node_modules/next/dist/bin/next`, 'dev', '--webpack', '--hostname', 'localhost', '--port', String(port)], cwd, { NEXT_PUBLIC_API_URL: 'http://localhost:8787' });
    }
    console.log('\nAdmin: http://localhost:3000\nPartners: http://localhost:3001');
  }
  console.log('Hoysii local API: http://localhost:8787\nUse localhost consistently. Ctrl+C stops the servers.');
  console.log('First run? Stop and run node scripts/dev-local.mjs --setup. Local accounts and data are separate from live.');
  console.log(`Admin setup: http://localhost:3000/admin/setup (email: ${config.ADMIN_EMAIL}). Wrangler prints local email file paths for setup links and codes.\n`);
}

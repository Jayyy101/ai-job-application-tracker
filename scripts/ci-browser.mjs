/** Run the existing isolated browser suite against a temporary production frontend.
 * Requires a completed frontend build, Python dependencies and Chrome on PATH.
 * Never connects to an existing application server or private database.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = process.env.TRACKER_ARTIFACTS_PARENT || os.tmpdir();
fs.mkdirSync(parent, { recursive: true });
const artifacts = fs.mkdtempSync(path.join(parent, 'jobfolio-ci-frontend-'));
const reserve = net.createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const preview = `http://127.0.0.1:${port}`;
const log = fs.openSync(path.join(artifacts, 'frontend.log'), 'w');
const frontend = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: path.join(root, 'frontend'), env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', OPENAI_API_KEY: '' }, stdio: ['ignore', log, log],
});
let suite;
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const forced = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited; clearTimeout(forced);
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (frontend.exitCode !== null) throw new Error('Temporary frontend exited: ' + fs.readFileSync(path.join(artifacts, 'frontend.log'), 'utf8'));
    try { if ((await fetch(preview, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch { /* wait for our own process */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Temporary frontend failed to become ready; see ' + artifacts);
  suite = spawn(process.execPath, [path.join(root, 'scripts/browser-check.mjs')], {
    cwd: root, env: { ...process.env, TRACKER_PREVIEW_URL: preview, OPENAI_API_KEY: '' }, stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => { suite.once('error', reject); suite.once('exit', code => resolve(code)); });
  if (code !== 0) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await stop(suite); await stop(frontend); fs.closeSync(log); }

#!/usr/bin/env node
/**
 * Supervisor for the startpage server when it runs as a Windows scheduled task:
 *
 *   node scripts/supervise.mjs   → server/dist/index.js (API + built SPA on :8800)
 *
 * Task Scheduler gives a task no console, so anything the child prints is lost;
 * this tees both streams to logs/app.log. It also restarts the child itself rather
 * than leaning on the task's RestartOnFailure, which gives up after 3 tries.
 *
 * The child is spawned rather than imported so a crash in it is a child exit this
 * process can see, instead of taking the supervisor down with it.
 * (Trimmed from job-apps/scripts/supervise.mjs.)
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, renameSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = path.join(ROOT, 'server', 'dist', 'index.js');
const CWD = path.join(ROOT, 'server');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG = path.join(LOG_DIR, 'app.log');
const MAX_LOG_BYTES = 16 * 1024 * 1024;

const MIN_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;
// A child that stayed up this long counts as healthy, so the next crash starts
// backing off from scratch instead of inheriting an hour-old penalty.
const HEALTHY_MS = 60_000;

mkdirSync(LOG_DIR, { recursive: true });

// One rotation, checked only at startup: a long-lived process writes slowly.
try {
  if (statSync(LOG).size > MAX_LOG_BYTES) renameSync(LOG, `${LOG}.1`);
} catch {
  /* no log yet */
}

const logStream = createWriteStream(LOG, { flags: 'a' });
const log = (line) => logStream.write(`[${new Date().toISOString()}] ${line}\n`);

let child = null;
let backoff = MIN_BACKOFF_MS;
let stopping = false;

function start() {
  const startedAt = Date.now();
  child = spawn(process.execPath, [ENTRY], {
    cwd: CWD,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  log(`startpage started (pid ${child.pid})`);

  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });

  child.on('exit', (code, signal) => {
    child = null;
    if (stopping) return;
    // Stop-ScheduledTask delivers CTRL+BREAK to the console group and the child dies
    // with STATUS_CONTROL_C_EXIT before this process sees SIGBREAK (if it ever does).
    // That exit code only ever means "someone is stopping us".
    if (code === 0xc000013a) {
      log('startpage exited on CTRL+BREAK (task stop); supervisor exiting');
      logStream.end(() => process.exit(0));
      return;
    }
    if (Date.now() - startedAt > HEALTHY_MS) backoff = MIN_BACKOFF_MS;
    log(`startpage exited (code ${code}, signal ${signal}); restarting in ${backoff / 1000}s`);
    setTimeout(start, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  });

  child.on('error', (err) => log(`spawn failed: ${err.message}`));
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(sig, () => {
    stopping = true;
    log(`got ${sig}, stopping`);
    child?.kill();
    logStream.end(() => process.exit(0));
  });
}

start();

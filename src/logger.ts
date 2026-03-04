// Lightweight logger — writes WARN/ERROR to file, INFO only to stdout
// Files: logs/mcp-YYYY-MM-DD.log — rotated daily, kept for 7 days, max 10 MB/file

import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const LOG_DIR   = join(__dirname, '../logs');
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — stop writing if exceeded
const KEEP_DAYS = 7;

/** Strip ANSI escape codes from a string */
function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function logFile(): string {
  return join(LOG_DIR, `mcp-${today()}.log`);
}

function ensureDir(): void {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
}

function pruneOldLogs(): void {
  try {
    const cutoff = Date.now() - KEEP_DAYS * 86400_000;
    for (const f of readdirSync(LOG_DIR)) {
      if (!f.startsWith('mcp-') || !f.endsWith('.log')) continue;
      const fp = join(LOG_DIR, f);
      if (statSync(fp).mtimeMs < cutoff) unlinkSync(fp);
    }
  } catch { /* non-fatal */ }
}

function writeToFile(level: string, message: string): void {
  try {
    ensureDir();
    const fp = logFile();
    if (existsSync(fp) && statSync(fp).size >= MAX_BYTES) return; // file too large
    appendFileSync(fp, `[${timestamp()}] ${level} ${message}\n`, 'utf8');
  } catch { /* never crash the server over logging */ }
}

// Prune old logs once at startup
let pruned = false;
function maybePrune(): void {
  if (!pruned) { pruned = true; pruneOldLogs(); }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Informational — stdout only, not written to file */
export function info(message: string): void {
  console.log(`[INFO] ${stripAnsi(message)}`);
}

/** Warning — stdout + file */
export function warn(message: string): void {
  maybePrune();
  const clean = stripAnsi(message);
  console.warn(`[WARN] ${clean}`);
  writeToFile('WARN ', clean);
}

/** Error — stdout + file */
export function error(message: string, err?: unknown): void {
  maybePrune();
  const detail = err instanceof Error ? ` — ${err.message}` : (err ? ` — ${String(err)}` : '');
  const line = stripAnsi(`${message}${detail}`);
  console.error(`[ERROR] ${line}`);
  writeToFile('ERROR', line);
}

/** Tool call result — logs only if there was an error in the result */
export function toolResult(tool: string, result: unknown): void {
  if (result && typeof result === 'object' && 'error' in result) {
    error(`tool:${tool} returned error: ${(result as { error: unknown }).error}`);
  }
}

/** SQL query failure — logged as error */
export function queryFailed(key: string, sql: string, err: unknown): void {
  const snippet = sql.trim().slice(0, 80).replace(/\s+/g, ' ');
  error(`query:${key} failed [${snippet}]`, err);
}

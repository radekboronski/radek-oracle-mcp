// Radek Oracle MCP — Oracle 19c connection pool + version cache

import oracledb from 'oracledb';
import * as log from '../logger';

// Use thin mode by default (no Oracle client required)
oracledb.initOracleClient = undefined as unknown as typeof oracledb.initOracleClient;

/** Safety cap: truncate large result sets to avoid MCP token limit errors. */
const MAX_ROWS = 300;

// ─── Connection pool ──────────────────────────────────────────────────────────
// One pool per unique dbUrl

const pools = new Map<string, oracledb.Pool>();

export interface OracleVersion {
  major: number;
  minor: number;
  patch: number;
  full: string;
}

const versionCache = new Map<string, OracleVersion>();

export interface ParsedOracleUrl {
  user: string;
  password: string;
  connectString: string;
  ssl: boolean;
}

/**
 * Parse oracle://user:pass@host:1521/service or
 *        oracle+ssl://user:pass@host:1522/service
 */
export function parseOracleUrl(dbUrl: string): ParsedOracleUrl {
  const url = new URL(dbUrl.replace(/^oracle\+ssl:\/\//, 'oracle-ssl://').replace(/^oracle:\/\//, 'oracle://'));
  const ssl = dbUrl.startsWith('oracle+ssl://') || url.searchParams.get('ssl') === 'true';
  const host = url.hostname;
  const port = url.port || '1521';
  const service = url.pathname.replace(/^\//, '') || 'ORCL';
  const connectString = `${host}:${port}/${service}`;
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    connectString,
    ssl,
  };
}

async function getPool(dbUrl: string): Promise<oracledb.Pool> {
  if (pools.has(dbUrl)) return pools.get(dbUrl)!;
  const opts = parseOracleUrl(dbUrl);
  const pool = await oracledb.createPool({
    user: opts.user,
    password: opts.password,
    connectString: opts.connectString,
    poolMax: 5,
    poolMin: 1,
    poolIncrement: 1,
    poolTimeout: 60,
    stmtCacheSize: 30,
  });
  pools.set(dbUrl, pool);
  return pool;
}

// ─── query ────────────────────────────────────────────────────────────────────

/**
 * Run a single SQL query. Returns rows as plain objects.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  dbUrl: string,
  sql: string,
  params: Record<string, unknown> | unknown[] = []
): Promise<T[]> {
  const pool = await getPool(dbUrl);
  let conn: oracledb.Connection | undefined;
  try {
    conn = await pool.getConnection();
    const result = await conn.execute(sql, params, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      maxRows: MAX_ROWS + 1,
    });
    const rows = (result.rows ?? []) as T[];
    return rows.length > MAX_ROWS ? rows.slice(0, MAX_ROWS) : rows;
  } finally {
    if (conn) await conn.close().catch(() => {});
  }
}

// ─── multiQuery ───────────────────────────────────────────────────────────────

export async function multiQuery(
  dbUrl: string,
  queries: Record<string, string>
): Promise<Record<string, unknown[] | { error: string }>> {
  const results: Record<string, unknown[] | { error: string }> = {};
  const warnings: string[] = [];

  await Promise.all(
    Object.entries(queries).map(async ([key, sql]) => {
      try {
        const rows = await query(dbUrl, sql);
        if (rows.length === MAX_ROWS) {
          warnings.push(`"${key}": truncated to ${MAX_ROWS} rows.`);
        }
        results[key] = rows;
      } catch (e) {
        log.queryFailed(key, sql, e);
        results[key] = { error: (e as Error).message };
      }
    })
  );

  if (warnings.length) results._warnings = warnings;
  return results;
}

// ─── Oracle version detection ──────────────────────────────────────────────────

/**
 * Detect Oracle version from v$instance. Caches per dbUrl. Falls back to 19.0.0.
 */
export async function getOracleVersion(dbUrl: string): Promise<OracleVersion> {
  if (versionCache.has(dbUrl)) return versionCache.get(dbUrl)!;
  try {
    type Row = { VERSION_FULL: string; VERSION: string };
    const rows = await query<Row>(dbUrl,
      `SELECT instance_name, version, version_full FROM v$instance`
    );
    const full = rows[0]?.VERSION_FULL ?? rows[0]?.VERSION ?? '19.0.0';
    const parts = full.split('.');
    const v: OracleVersion = {
      major: parseInt(parts[0] ?? '19', 10),
      minor: parseInt(parts[1] ?? '0', 10),
      patch: parseInt(parts[2] ?? '0', 10),
      full,
    };
    versionCache.set(dbUrl, v);
    return v;
  } catch {
    const v: OracleVersion = { major: 19, minor: 0, patch: 0, full: '19.0.0' };
    versionCache.set(dbUrl, v);
    return v;
  }
}

/**
 * Returns true if Oracle version is 12c or higher (supports FETCH FIRST, CDB, etc.)
 */
export async function isOracle12Plus(dbUrl: string): Promise<boolean> {
  const v = await getOracleVersion(dbUrl);
  return v.major >= 12;
}

/**
 * Returns true if Oracle version is 19c or higher.
 */
export async function isOracle19Plus(dbUrl: string): Promise<boolean> {
  const v = await getOracleVersion(dbUrl);
  return v.major >= 19;
}

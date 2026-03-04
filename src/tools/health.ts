// Radek Oracle MCP — health_check tool

import { multiQuery, getOracleVersion } from './db';
import { healthQueries as Q } from '../queries/health';

export async function health_check(dbUrl: string): Promise<Record<string, unknown>> {
  const [version, data] = await Promise.all([
    getOracleVersion(dbUrl),
    multiQuery(dbUrl, {
      database:        Q.database,
      instance:        Q.instance,
      sga:             Q.sga,
      pga:             Q.pga,
      sessions:        Q.sessions,
      buffer_cache_hit: Q.buffer_cache_hit,
      library_cache:   Q.library_cache_hit,
      sysstat:         Q.sysstat_key,
      tablespaces:     Q.tablespace_summary,
      wait_events:     Q.wait_events_top,
      active_locks:    Q.active_locks,
      invalid_objects: Q.invalid_objects,
      redo_logs:       Q.redo_log_status,
    }),
  ]);

  // --- Health status evaluation ---
  const issues: string[] = [];
  const warnings: string[] = [];
  let health_level = 'OK';

  // Buffer cache hit ratio
  type HitRow = { BUFFER_CACHE_HIT_PCT: number };
  const hitRow = (data.buffer_cache_hit as HitRow[])?.[0];
  const bufHitPct = hitRow?.BUFFER_CACHE_HIT_PCT ?? 100;
  if (bufHitPct < 85) {
    health_level = 'CRITICAL';
    issues.push(`Buffer cache hit ratio low: ${bufHitPct}% (target >= 95%). Increase DB_CACHE_SIZE or SGA_TARGET.`);
  } else if (bufHitPct < 95) {
    if (health_level === 'OK') health_level = 'WARNING';
    warnings.push(`Buffer cache hit ratio: ${bufHitPct}% (target >= 95%). Consider increasing DB_CACHE_SIZE.`);
  }

  // Active locks
  type LockRow = { BLOCKING_COUNT: number };
  const lockRow = (data.active_locks as LockRow[])?.[0];
  if ((lockRow?.BLOCKING_COUNT ?? 0) > 0) {
    health_level = 'CRITICAL';
    issues.push(`${lockRow?.BLOCKING_COUNT} blocking lock(s) detected. Run analyze_locks for details.`);
  }

  // Invalid objects
  type InvalidRow = { INVALID_COUNT: number };
  const invRow = (data.invalid_objects as InvalidRow[])?.[0];
  if ((invRow?.INVALID_COUNT ?? 0) > 0) {
    if (health_level === 'OK') health_level = 'WARNING';
    warnings.push(`${invRow?.INVALID_COUNT} invalid objects detected. Run analyze_schema for details.`);
  }

  // Tablespace fullness
  type TsRow = { TABLESPACE_NAME: string; PCT_USED: number };
  const tsRows = Array.isArray(data.tablespaces) ? (data.tablespaces as TsRow[]) : [];
  for (const ts of tsRows) {
    if (ts.PCT_USED >= 95) {
      health_level = 'CRITICAL';
      issues.push(`Tablespace ${ts.TABLESPACE_NAME} is ${ts.PCT_USED}% full.`);
    } else if (ts.PCT_USED >= 85) {
      if (health_level === 'OK') health_level = 'WARNING';
      warnings.push(`Tablespace ${ts.TABLESPACE_NAME} is ${ts.PCT_USED}% full.`);
    }
  }

  return {
    health_level,
    issues,
    warnings,
    oracle_version: version.full,
    data,
  };
}

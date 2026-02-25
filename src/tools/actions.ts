// Radek Oracle MCP — run_query, kill_session

import { query } from './db';

export async function run_query(dbUrl: string, sql: string): Promise<Record<string, unknown>> {
  const rows = await query(dbUrl, sql);
  return { rows, row_count: rows.length };
}

export async function kill_session(
  dbUrl: string,
  sid: number,
  serial: number,
  force = false
): Promise<Record<string, unknown>> {
  if (!Number.isInteger(sid) || sid <= 0) throw new Error('sid must be a positive integer');
  if (!Number.isInteger(serial) || serial <= 0) throw new Error('serial# must be a positive integer');

  const killSql = `ALTER SYSTEM KILL SESSION '${sid},${serial}'${force ? ' IMMEDIATE' : ''}`;
  await query(dbUrl, killSql);
  return {
    success: true,
    message: `Session SID=${sid},SERIAL#=${serial} kill command sent (${force ? 'IMMEDIATE' : 'graceful'}).`,
    sql: killSql,
  };
}

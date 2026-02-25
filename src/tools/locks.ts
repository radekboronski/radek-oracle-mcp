// Radek Oracle MCP — analyze_locks tool

import { multiQuery } from './db';
import { lockQueries as Q } from '../queries/locks';

export async function analyze_locks(
  dbUrl: string,
  focus = 'all'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:          ['blocking_sessions','waiting_sessions','all_locks','active_transactions','ddl_locks'],
    blocking:     ['blocking_sessions','waiting_sessions'],
    current:      ['all_locks'],
    transactions: ['active_transactions'],
    ddl:          ['ddl_locks'],
  };

  const keys = focusMap[focus] ?? focusMap.all;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Blocking sessions
  type BlockRow = { BLOCKING_SID: number; BLOCKING_SERIAL: number; BLOCKING_USER: string; BLOCKING_SECONDS: number };
  const blockers = (data.blocking_sessions as BlockRow[]) ?? [];
  for (const b of blockers) {
    recommendations.push(
      `BLOCKING SESSION: SID=${b.BLOCKING_SID} SERIAL#=${b.BLOCKING_SERIAL} (${b.BLOCKING_USER}) ` +
      `blocking for ${b.BLOCKING_SECONDS}s — kill: ALTER SYSTEM KILL SESSION '${b.BLOCKING_SID},${b.BLOCKING_SERIAL}' IMMEDIATE;`
    );
  }

  // Active transactions running too long
  type TxnRow = { SID: number; SERIAL_: number; USERNAME: string; UNDO_KB: number; START_TIME: string };
  const txns = (data.active_transactions as TxnRow[]) ?? [];
  for (const t of txns) {
    if (t.UNDO_KB > 100_000) {
      recommendations.push(
        `LARGE TRANSACTION: SID=${t.SID} (${t.USERNAME}) using ${Math.round(t.UNDO_KB / 1024)}MB undo since ${t.START_TIME}. ` +
        `Consider: ALTER SYSTEM KILL SESSION '${t.SID},${t.SERIAL_}' IMMEDIATE;`
      );
    }
  }

  return { focus, data, recommendations };
}

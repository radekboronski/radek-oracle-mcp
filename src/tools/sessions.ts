// Radek Oracle MCP — analyze_sessions tool

import { multiQuery } from './db';
import { sessionQueries as Q } from '../queries/sessions';

export async function analyze_sessions(
  dbUrl: string,
  focus = 'summary'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:            ['all_sessions','session_limits'],
    summary:        ['all_sessions','by_user','session_limits'],
    active:         ['active_sessions'],
    long_running:   ['long_running'],
    by_user:        ['by_user'],
    by_machine:     ['by_machine'],
    by_program:     ['by_program'],
    sleeping:       ['sleeping'],
    long_ops:       ['long_operations'],
    limits:         ['session_limits'],
  };

  const keys = focusMap[focus] ?? focusMap.summary;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Sessions close to limit
  type LimitRow = { RESOURCE_NAME: string; CURRENT_UTILIZATION: number; MAX_UTILIZATION: number; LIMIT_VALUE: string };
  const limits = (data.session_limits as LimitRow[]) ?? [];
  for (const l of limits) {
    const limitVal = parseInt(l.LIMIT_VALUE, 10);
    if (!isNaN(limitVal) && limitVal > 0) {
      const pct = (l.CURRENT_UTILIZATION / limitVal) * 100;
      if (pct > 85) {
        recommendations.push(
          `${l.RESOURCE_NAME} at ${l.CURRENT_UTILIZATION}/${limitVal} (${pct.toFixed(0)}%). ` +
          `Increase in spfile: ALTER SYSTEM SET ${l.RESOURCE_NAME.toLowerCase()} = ${Math.ceil(limitVal * 1.5)} SCOPE=SPFILE;`
        );
      }
    }
  }

  // Long running sessions
  type LongRow = { SID: number; SERIAL_: number; USERNAME: string; ELAPSED_SECONDS: number };
  const longSessions = (data.long_running as LongRow[]) ?? [];
  for (const s of longSessions) {
    if (s.ELAPSED_SECONDS > 300) {
      recommendations.push(
        `LONG SESSION: SID=${s.SID} (${s.USERNAME}) running ${s.ELAPSED_SECONDS}s. ` +
        `Kill: ALTER SYSTEM KILL SESSION '${s.SID},${s.SERIAL_}' IMMEDIATE;`
      );
    }
  }

  return { focus, data, recommendations };
}

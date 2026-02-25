// Radek Oracle MCP — analyze_waits tool

import { multiQuery } from './db';
import { waitQueries as Q } from '../queries/waits';

export async function analyze_waits(
  dbUrl: string,
  focus = 'summary'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:         ['system_events','wait_classes','current_waits','enqueue_waits','latch_misses'],
    summary:     ['system_events','wait_classes'],
    current:     ['current_waits'],
    io:          ['io_waits'],
    concurrency: ['concurrency_waits'],
    enqueue:     ['enqueue_waits'],
    latch:       ['latch_misses'],
    history:     ['session_waits_history'],
    ash:         ['ash_recent'],
  };

  const keys = focusMap[focus] ?? focusMap.summary;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Top wait events analysis
  type EventRow = { EVENT: string; WAIT_CLASS: string; TIME_WAITED_SECS: number; AVG_WAIT_MS: number };
  const events = (data.system_events as EventRow[]) ?? [];
  for (const e of events.slice(0, 5)) {
    if (e.WAIT_CLASS === 'User I/O' && e.AVG_WAIT_MS > 20) {
      recommendations.push(
        `HIGH I/O WAIT: "${e.EVENT}" avg ${e.AVG_WAIT_MS}ms. ` +
        `Check datafile I/O with analyze_storage, consider adding more memory: ` +
        `ALTER SYSTEM SET DB_CACHE_SIZE = <larger_value> SCOPE=BOTH;`
      );
    }
    if (e.WAIT_CLASS === 'Concurrency' && e.TIME_WAITED_SECS > 60) {
      recommendations.push(
        `CONCURRENCY WAIT: "${e.EVENT}" total ${e.TIME_WAITED_SECS}s. ` +
        `Investigate locking: run analyze_locks focus: "blocking".`
      );
    }
    if (e.EVENT === 'log file sync' && e.AVG_WAIT_MS > 10) {
      recommendations.push(
        `REDO LOG WAIT: "log file sync" avg ${e.AVG_WAIT_MS}ms. ` +
        `Increase log_buffer or move redo logs to faster disk. ` +
        `ALTER SYSTEM SET LOG_BUFFER = 33554432 SCOPE=SPFILE;`
      );
    }
  }

  return { focus, data, recommendations };
}

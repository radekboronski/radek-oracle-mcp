// Radek Oracle MCP — analyze_undo tool

import { multiQuery } from './db';
import { undoQueries as Q } from '../queries/undo';

export async function analyze_undo(dbUrl: string): Promise<Record<string, unknown>> {
  const data = await multiQuery(dbUrl, {
    undo_stats:   Q.undo_stats,
    parameters:   Q.undo_parameters,
    segments:     Q.undo_segments,
    usage:        Q.undo_usage,
    long_txns:    Q.long_running_queries,
  });

  const recommendations: string[] = [];

  // Snapshot too old errors
  type UndoRow = { SNAPSHOT_TOO_OLD_ERRS: number; NO_SPACE_ERRS: number; MAXQUERYLEN: number };
  const undoRows = (data.undo_stats as UndoRow[]) ?? [];
  const totalOldErrors = undoRows.reduce((sum, r) => sum + (r.SNAPSHOT_TOO_OLD_ERRS ?? 0), 0);
  const totalNoSpace = undoRows.reduce((sum, r) => sum + (r.NO_SPACE_ERRS ?? 0), 0);

  if (totalOldErrors > 0) {
    const maxQuery = Math.max(...undoRows.map(r => r.MAXQUERYLEN ?? 0));
    recommendations.push(
      `ORA-01555 SNAPSHOT TOO OLD: ${totalOldErrors} occurrences. ` +
      `Longest query: ${maxQuery}s. ` +
      `Increase UNDO_RETENTION: ALTER SYSTEM SET UNDO_RETENTION = ${Math.max(900, maxQuery + 300)} SCOPE=BOTH; ` +
      `And guarantee retention: ALTER TABLESPACE <undo_ts> RETENTION GUARANTEE;`
    );
  }

  if (totalNoSpace > 0) {
    recommendations.push(
      `UNDO SPACE ERRORS: ${totalNoSpace} occurrences. ` +
      `Add datafile to undo tablespace or increase size.`
    );
  }

  return { data, recommendations };
}

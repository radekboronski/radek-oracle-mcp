// Radek Oracle MCP — analyze_statistics tool

import { multiQuery } from './db';
import { statisticsQueries as Q } from '../queries/statistics';

export async function analyze_statistics(
  dbUrl: string,
  focus = 'stale'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:        ['stale_stats','table_stats','index_stats','optimizer_parameters','gather_stats_job'],
    stale:      ['stale_stats'],
    tables:     ['table_stats'],
    indexes:    ['index_stats'],
    columns:    ['column_stats'],
    pending:    ['pending_stats'],
    optimizer:  ['optimizer_parameters'],
    job:        ['gather_stats_job'],
  };

  const keys = focusMap[focus] ?? focusMap.stale;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Stale stats
  type StaleRow = { OWNER: string; TABLE_NAME: string; DAYS_STALE: number; STALE_STATS: string };
  const stale = (data.stale_stats as StaleRow[]) ?? [];
  if (stale.length > 0) {
    recommendations.push(
      `${stale.length} tables have stale or missing statistics. ` +
      `Gather all: EXEC DBMS_STATS.GATHER_SCHEMA_STATS('<SCHEMA>', CASCADE => TRUE); ` +
      `Or for specific tables: EXEC DBMS_STATS.GATHER_TABLE_STATS('<OWNER>', '<TABLE>', CASCADE => TRUE);`
    );
  }

  return { focus, data, recommendations };
}

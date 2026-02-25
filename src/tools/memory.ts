// Radek Oracle MCP — analyze_memory tool

import { multiQuery } from './db';
import { memoryQueries as Q } from '../queries/memory';

export async function analyze_memory(
  dbUrl: string,
  focus = 'summary'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:        ['sga_components','pga_stats','memory_parameters','sort_overflow','db_cache_advisory','shared_pool_advisory'],
    summary:    ['sga_components','pga_stats','memory_parameters'],
    sga:        ['sga_components','sga_detail','buffer_pool_stats'],
    pga:        ['pga_stats','pga_histogram','pga_advisory'],
    advisory:   ['db_cache_advisory','shared_pool_advisory','pga_advisory'],
    parameters: ['memory_parameters'],
    sorts:      ['sort_overflow'],
  };

  const keys = focusMap[focus] ?? focusMap.summary;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Sort overflow analysis
  type SortRow = { DISK_SORT_PCT: number; DISK_SORTS: number; MEMORY_SORTS: number };
  const sortRow = (data.sort_overflow as SortRow[])?.[0];
  if (sortRow && sortRow.DISK_SORT_PCT > 5) {
    recommendations.push(
      `SORT OVERFLOW: ${sortRow.DISK_SORTS} disk sorts (${sortRow.DISK_SORT_PCT}%). ` +
      `Increase PGA_AGGREGATE_TARGET: ALTER SYSTEM SET PGA_AGGREGATE_TARGET = <larger_value> SCOPE=BOTH;`
    );
  }

  return { focus, data, recommendations };
}

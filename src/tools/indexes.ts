// Radek Oracle MCP — analyze_indexes + indexes_for_table + suggest_index tools

import { multiQuery, query } from './db';
import { indexQueries as Q } from '../queries/indexes';

export async function analyze_indexes(
  dbUrl: string,
  focus = 'overview'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:           ['all_indexes','low_cardinality','invisible_indexes','unusable_indexes','duplicate_candidates'],
    overview:      ['all_indexes'],
    unused:        ['index_usage'],
    low_cardinality:['low_cardinality'],
    invisible:     ['invisible_indexes'],
    unusable:      ['unusable_indexes'],
    duplicates:    ['duplicate_candidates'],
    columns:       ['index_columns'],
  };

  const keys = focusMap[focus] ?? focusMap.overview;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Unusable indexes
  type UnusableRow = { OWNER: string; INDEX_NAME: string; TABLE_NAME: string };
  const unusable = (data.unusable_indexes as UnusableRow[]) ?? [];
  for (const idx of unusable) {
    recommendations.push(
      `UNUSABLE INDEX: ${idx.OWNER}.${idx.INDEX_NAME} on ${idx.TABLE_NAME}. ` +
      `Rebuild: ALTER INDEX ${idx.OWNER}.${idx.INDEX_NAME} REBUILD;`
    );
  }

  // Invisible indexes (may be tests — check if needed)
  type InvisRow = { OWNER: string; INDEX_NAME: string; TABLE_NAME: string };
  const invisible = (data.invisible_indexes as InvisRow[]) ?? [];
  for (const idx of invisible) {
    recommendations.push(
      `INVISIBLE INDEX: ${idx.OWNER}.${idx.INDEX_NAME} on ${idx.TABLE_NAME}. ` +
      `Make visible: ALTER INDEX ${idx.OWNER}.${idx.INDEX_NAME} VISIBLE; ` +
      `Or drop: DROP INDEX ${idx.OWNER}.${idx.INDEX_NAME};`
    );
  }

  // Low cardinality indexes
  type LowCard = { OWNER: string; INDEX_NAME: string; TABLE_NAME: string; SELECTIVITY_PCT: number };
  const lowCard = (data.low_cardinality as LowCard[]) ?? [];
  for (const idx of lowCard.slice(0, 5)) {
    recommendations.push(
      `LOW CARDINALITY: ${idx.OWNER}.${idx.INDEX_NAME} on ${idx.TABLE_NAME} — ${idx.SELECTIVITY_PCT}% selectivity. ` +
      `Consider dropping: DROP INDEX ${idx.OWNER}.${idx.INDEX_NAME};`
    );
  }

  return { focus, data, recommendations };
}

export async function indexes_for_table(
  dbUrl: string,
  tableName: string
): Promise<Record<string, unknown>> {
  const parts = tableName.split('.');
  const owner = parts.length > 1 ? parts[0].toUpperCase() : null;
  const table = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase();

  const ownerVal = owner ?? (await query<{USER: string}>(dbUrl, `SELECT user AS "USER" FROM dual`))[0]?.USER ?? 'UNKNOWN';

  const rows = await query(dbUrl, Q.indexes_for_table, { owner: ownerVal, table_name: table });
  return { table_name: tableName, indexes: rows, count: rows.length };
}

export async function suggest_index(
  dbUrl: string,
  tableName: string,
  columns?: string[]
): Promise<Record<string, unknown>> {
  const parts = tableName.split('.');
  const owner = parts.length > 1 ? parts[0].toUpperCase() : null;
  const table = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase();
  const ownerVal = owner ?? (await query<{USER: string}>(dbUrl, `SELECT user AS "USER" FROM dual`))[0]?.USER ?? 'UNKNOWN';

  const indexName = `IDX_${table}_${(columns ?? []).join('_').toUpperCase()}`.slice(0, 30);
  const colList = columns ? columns.join(', ') : '<column_list>';
  const sql = `CREATE INDEX ${ownerVal}.${indexName} ON ${ownerVal}.${table} (${colList});`;

  return {
    suggested_sql: sql,
    note: 'This statement has NOT been executed. Review and run manually or with run_query.',
    table_name: tableName,
    columns: columns ?? [],
  };
}

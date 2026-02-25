// Radek Oracle MCP — analyze_tables + investigate_table tools

import { multiQuery, query, getOracleVersion } from './db';
import { tableQueries as Q } from '../queries/tables';
import { structureQueries as SQ } from '../queries/structure';

export async function analyze_tables(
  dbUrl: string,
  focus = 'sizes'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:          ['sizes','stats','stale_stats','partitioned','without_stats'],
    sizes:        ['sizes'],
    stats:        ['stats'],
    stale_stats:  ['stale_stats'],
    partitioned:  ['partitioned','partitions_detail'],
    without_stats:['without_stats'],
    hot:          ['hot_tables_io'],
    rows:         ['row_counts'],
  };

  const keys = focusMap[focus] ?? focusMap.sizes;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Stale statistics
  type StaleRow = { OWNER: string; TABLE_NAME: string; DAYS_STALE: number; STALE_STATS: string };
  const stale = (data.stale_stats as StaleRow[]) ?? [];
  for (const t of stale.slice(0, 10)) {
    recommendations.push(
      `STALE STATS: ${t.OWNER}.${t.TABLE_NAME} (${t.DAYS_STALE ?? 'never analyzed'} days old). ` +
      `EXEC DBMS_STATS.GATHER_TABLE_STATS('${t.OWNER}', '${t.TABLE_NAME}', CASCADE => TRUE);`
    );
  }

  return { focus, data, recommendations };
}

export async function investigate_table(
  dbUrl: string,
  tableName: string
): Promise<Record<string, unknown>> {
  // Parse owner.table syntax
  const parts = tableName.split('.');
  const owner = parts.length > 1 ? parts[0].toUpperCase() : null;
  const table = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase();

  type SizeRow = { OWNER: string; SEGMENT_MB: number; BLOCKS: number; EXTENTS: number; TABLESPACE_NAME: string };
  type StatRow = { OWNER: string; TABLE_NAME: string; NUM_ROWS: number; LAST_ANALYZED: string; STALE_STATS: string; BLOCKS: number; AVG_ROW_LEN: number };

  // Build queries
  const ownerFilter = owner ? `AND s.owner = '${owner}'` : '';
  const ownerFilter2 = owner ? `AND owner = '${owner}'` : '';

  const sizeQ = `SELECT s.owner, ROUND(s.bytes/1024/1024, 2) AS segment_mb, s.blocks, s.extents, s.tablespace_name FROM dba_segments s WHERE s.segment_type = 'TABLE' AND s.segment_name = '${table}' ${ownerFilter} FETCH FIRST 1 ROWS ONLY`;
  const statsQ = `SELECT owner, table_name, num_rows, blocks, avg_row_len, TO_CHAR(last_analyzed,'YYYY-MM-DD HH24:MI:SS') AS last_analyzed, stale_stats FROM dba_tab_statistics WHERE table_name = '${table}' ${ownerFilter2} FETCH FIRST 1 ROWS ONLY`;
  const colsQ = SQ.table_columns.replace(':owner', `'${owner ?? (await query(dbUrl, `SELECT user FROM dual`))[0]}'`).replace(':table_name', `'${table}'`);
  const idxQ = `SELECT i.index_name, i.index_type, i.status, i.uniqueness, i.visibility, i.num_rows, i.distinct_keys, LISTAGG(ic.column_name||' '||ic.descend,', ') WITHIN GROUP (ORDER BY ic.column_position) AS columns FROM dba_indexes i JOIN dba_ind_columns ic ON i.owner=ic.index_owner AND i.index_name=ic.index_name WHERE i.table_name='${table}' ${ownerFilter.replace('s.owner','i.owner')} GROUP BY i.index_name,i.index_type,i.status,i.uniqueness,i.visibility,i.num_rows,i.distinct_keys ORDER BY i.index_name`;
  const constQ = `SELECT constraint_name, constraint_type, status, validated FROM dba_constraints WHERE table_name='${table}' ${ownerFilter2} ORDER BY constraint_type, constraint_name`;

  const data = await multiQuery(dbUrl, { size: sizeQ, stats: statsQ, indexes: idxQ, constraints: constQ });
  const recommendations: string[] = [];

  const statsRow = (data.stats as StatRow[])?.[0];
  if (statsRow?.STALE_STATS === 'YES' || !statsRow?.LAST_ANALYZED) {
    recommendations.push(
      `Stale or missing statistics on ${table}. ` +
      `EXEC DBMS_STATS.GATHER_TABLE_STATS('${statsRow?.OWNER ?? owner ?? 'OWNER'}', '${table}', CASCADE => TRUE);`
    );
  }

  const sizeRow = (data.size as SizeRow[])?.[0];
  if (sizeRow && statsRow?.NUM_ROWS && sizeRow.EXTENTS > 1000) {
    recommendations.push(
      `Table ${table} has ${sizeRow.EXTENTS} extents — high fragmentation. ` +
      `Consider: ALTER TABLE ${table} MOVE; -- followed by: ALTER INDEX <all_indexes> REBUILD;`
    );
  }

  return { table_name: tableName, data, recommendations };
}

export async function list_tables(dbUrl: string): Promise<Record<string, unknown>> {
  const rows = await query(dbUrl, `
    SELECT s.owner, s.segment_name AS table_name,
           ROUND(s.bytes/1024/1024, 2) AS size_mb, s.tablespace_name
    FROM dba_segments s
    WHERE s.segment_type = 'TABLE'
    AND s.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY s.bytes DESC
    FETCH FIRST 200 ROWS ONLY
  `);
  return { tables: rows, count: rows.length };
}

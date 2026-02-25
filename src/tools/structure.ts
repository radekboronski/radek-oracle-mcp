// Radek Oracle MCP — analyze_schema + table_structure tools

import { multiQuery, query } from './db';
import { structureQueries as Q } from '../queries/structure';

export async function analyze_schema(
  dbUrl: string,
  focus = 'issues'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:            ['objects_by_type','invalid_objects','tables_without_pk','fk_without_index','disabled_constraints','triggers'],
    issues:         ['invalid_objects','tables_without_pk','fk_without_index','disabled_constraints'],
    objects:        ['objects_by_type'],
    invalid:        ['invalid_objects'],
    keys:           ['tables_without_pk','fk_without_index'],
    constraints:    ['constraints','disabled_constraints'],
    triggers:       ['triggers'],
    routines:       ['procedures_functions'],
    sequences:      ['sequences'],
    synonyms:       ['synonyms'],
    dblinks:        ['dblinks'],
    views:          ['views'],
  };

  const keys = focusMap[focus] ?? focusMap.issues;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Invalid objects
  type InvalidRow = { OWNER: string; OBJECT_NAME: string; OBJECT_TYPE: string };
  const invalid = (data.invalid_objects as InvalidRow[]) ?? [];
  if (invalid.length > 0) {
    recommendations.push(
      `${invalid.length} invalid objects found. ` +
      `Recompile: EXEC DBMS_UTILITY.COMPILE_SCHEMA('<SCHEMA>', COMPILE_ALL => FALSE); ` +
      `Or manually: ALTER PROCEDURE/FUNCTION/PACKAGE <name> COMPILE;`
    );
  }

  // Tables without PK
  type NoPkRow = { OWNER: string; TABLE_NAME: string };
  const noPk = (data.tables_without_pk as NoPkRow[]) ?? [];
  for (const t of noPk.slice(0, 5)) {
    recommendations.push(
      `TABLE WITHOUT PK: ${t.OWNER}.${t.TABLE_NAME}. ` +
      `Add primary key: ALTER TABLE ${t.OWNER}.${t.TABLE_NAME} ADD CONSTRAINT PK_${t.TABLE_NAME} PRIMARY KEY (<column>);`
    );
  }

  // FK without index
  type FkRow = { OWNER: string; TABLE_NAME: string; CONSTRAINT_NAME: string; FK_COLUMNS: string };
  const fkNoIdx = (data.fk_without_index as FkRow[]) ?? [];
  for (const fk of fkNoIdx.slice(0, 5)) {
    recommendations.push(
      `FK WITHOUT INDEX: ${fk.OWNER}.${fk.TABLE_NAME} (${fk.CONSTRAINT_NAME}) on columns: ${fk.FK_COLUMNS}. ` +
      `CREATE INDEX ${fk.OWNER}.IDX_${fk.TABLE_NAME}_FK_${fk.CONSTRAINT_NAME.slice(-8)} ` +
      `ON ${fk.OWNER}.${fk.TABLE_NAME} (${fk.FK_COLUMNS});`
    );
  }

  // Disabled constraints
  type DisabledRow = { OWNER: string; TABLE_NAME: string; CONSTRAINT_NAME: string; CONSTRAINT_TYPE: string };
  const disabled = (data.disabled_constraints as DisabledRow[]) ?? [];
  for (const c of disabled.slice(0, 5)) {
    recommendations.push(
      `DISABLED CONSTRAINT: ${c.OWNER}.${c.TABLE_NAME}.${c.CONSTRAINT_NAME} (${c.CONSTRAINT_TYPE}). ` +
      `Re-enable: ALTER TABLE ${c.OWNER}.${c.TABLE_NAME} ENABLE CONSTRAINT ${c.CONSTRAINT_NAME};`
    );
  }

  return { focus, data, recommendations };
}

export async function table_structure(
  dbUrl: string,
  tableName: string
): Promise<Record<string, unknown>> {
  const parts = tableName.split('.');
  const owner = parts.length > 1 ? parts[0].toUpperCase() : null;
  const table = (parts.length > 1 ? parts[1] : parts[0]).toUpperCase();
  const ownerVal = owner ?? (await query<{USER: string}>(dbUrl, `SELECT user AS "USER" FROM dual`))[0]?.USER ?? 'UNKNOWN';

  const data = await multiQuery(dbUrl, {
    columns:     Q.table_columns.replace(':owner', `'${ownerVal}'`).replace(':table_name', `'${table}'`),
    constraints: Q.table_constraints_detail.replace(/:owner/g, `'${ownerVal}'`).replace(/:table_name/g, `'${table}'`),
    indexes:     `SELECT i.index_name, i.index_type, i.status, i.uniqueness, i.visibility, i.num_rows, i.distinct_keys, LISTAGG(ic.column_name||' '||ic.descend,', ') WITHIN GROUP (ORDER BY ic.column_position) AS columns, s.bytes/1024/1024 AS size_mb FROM dba_indexes i JOIN dba_ind_columns ic ON i.owner=ic.index_owner AND i.index_name=ic.index_name LEFT JOIN dba_segments s ON s.owner=i.owner AND s.segment_name=i.index_name WHERE i.table_owner='${ownerVal}' AND i.table_name='${table}' GROUP BY i.index_name,i.index_type,i.status,i.uniqueness,i.visibility,i.num_rows,i.distinct_keys,s.bytes ORDER BY i.index_name`,
    stats:       `SELECT num_rows, blocks, avg_row_len, TO_CHAR(last_analyzed,'YYYY-MM-DD HH24:MI:SS') AS last_analyzed, stale_stats FROM dba_tab_statistics WHERE owner='${ownerVal}' AND table_name='${table}'`,
  });

  return { owner: ownerVal, table_name: table, data };
}

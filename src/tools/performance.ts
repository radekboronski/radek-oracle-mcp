// Radek Oracle MCP — analyze_sql + explain_query tools

import { multiQuery, query, getOracleVersion } from './db';
import { performanceQueries as Q } from '../queries/performance';

export async function analyze_sql(
  dbUrl: string,
  focus = 'top_elapsed'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:           ['top_elapsed','top_cpu','top_disk','parse_analysis','cursor_efficiency'],
    top_elapsed:   ['top_elapsed'],
    top_cpu:       ['top_cpu'],
    top_disk:      ['top_disk'],
    top_buffer:    ['top_buffer'],
    top_executions:['top_executions'],
    top_rows:      ['top_rows'],
    running:       ['running_sql'],
    parse:         ['parse_analysis','cursor_efficiency','shared_pool'],
    errors:        ['sql_errors'],
    full_scans:    ['full_table_scans'],
  };

  const keys = focusMap[focus] ?? focusMap.top_elapsed;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Hard parse ratio analysis
  type ParseRow = { HARD_PARSE_PCT: number; TOTAL_PARSES: number; HARD_PARSES: number };
  const parseRow = (data.parse_analysis as ParseRow[])?.[0];
  if (parseRow && parseRow.HARD_PARSE_PCT > 10) {
    recommendations.push(
      `Hard parse ratio is ${parseRow.HARD_PARSE_PCT}% (${parseRow.HARD_PARSES} hard / ${parseRow.TOTAL_PARSES} total). ` +
      `Use bind variables and set: ALTER SYSTEM SET cursor_sharing = 'FORCE' SCOPE=BOTH; ` +
      `Or set shared_pool_size larger.`
    );
  }

  return { focus, data, recommendations };
}

export async function explain_query(
  dbUrl: string,
  queryText: string
): Promise<Record<string, unknown>> {
  const upper = queryText.trim().toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    throw new Error('explain_query only accepts SELECT or WITH queries');
  }

  const version = await getOracleVersion(dbUrl);

  // Use EXPLAIN PLAN FOR + DBMS_XPLAN
  await query(dbUrl, `EXPLAIN PLAN FOR ${queryText}`);

  type PlanRow = { PLAN_TABLE_OUTPUT: string };
  let planRows: PlanRow[] = [];

  if (version.major >= 10) {
    planRows = await query<PlanRow>(dbUrl,
      `SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'ALL'))`
    );
  } else {
    planRows = await query<PlanRow>(dbUrl,
      `SELECT LPAD(' ', LEVEL-1) || operation || ' ' || options ||
              ' ' || object_name || ' (cost=' || cost || ' rows=' || cardinality || ')' AS plan_table_output
       FROM plan_table
       START WITH id = 0 CONNECT BY PRIOR id = parent_id`
    );
  }

  const plan_text = planRows.map(r => r.PLAN_TABLE_OUTPUT).join('\n');
  return { oracle_version: version.full, query: queryText, plan: plan_text, plan_rows: planRows };
}

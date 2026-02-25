// Radek Oracle MCP — analyze_tablespaces tool

import { multiQuery } from './db';
import { tablespaceQueries as Q } from '../queries/tablespaces';

export async function analyze_tablespaces(
  dbUrl: string,
  focus = 'usage'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:          ['usage','datafiles','free_space','temp_tablespace','autoextend_risk','fragmentation'],
    usage:        ['usage'],
    datafiles:    ['datafiles'],
    free_space:   ['free_space'],
    temp:         ['temp_tablespace'],
    autoextend:   ['autoextend_risk'],
    fragmentation:['fragmentation'],
    undo:         ['undo_tablespace'],
  };

  const keys = focusMap[focus] ?? focusMap.usage;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // Tablespace fullness
  type TsRow = { TABLESPACE_NAME: string; PCT_USED: number; TOTAL_MB: number; FREE_MB: number };
  const tsRows = (data.usage as TsRow[]) ?? [];
  for (const ts of tsRows) {
    if (ts.PCT_USED >= 95) {
      recommendations.push(
        `CRITICAL: Tablespace ${ts.TABLESPACE_NAME} is ${ts.PCT_USED}% full (${ts.FREE_MB}MB free of ${ts.TOTAL_MB}MB). ` +
        `Add datafile: ALTER TABLESPACE ${ts.TABLESPACE_NAME} ADD DATAFILE SIZE 1G AUTOEXTEND ON NEXT 256M MAXSIZE UNLIMITED;`
      );
    } else if (ts.PCT_USED >= 80) {
      recommendations.push(
        `WARNING: Tablespace ${ts.TABLESPACE_NAME} is ${ts.PCT_USED}% full. ` +
        `Add datafile: ALTER TABLESPACE ${ts.TABLESPACE_NAME} ADD DATAFILE SIZE 1G AUTOEXTEND ON NEXT 256M MAXSIZE UNLIMITED;`
      );
    }
  }

  // Autoextend risk
  type AutoRow = { TABLESPACE_NAME: string; FILE_NAME: string; PCT_OF_MAX: number; CURRENT_MB: number; MAX_MB: number };
  const autoRows = (data.autoextend_risk as AutoRow[]) ?? [];
  for (const f of autoRows) {
    if (f.PCT_OF_MAX >= 90) {
      recommendations.push(
        `AUTOEXTEND RISK: ${f.FILE_NAME} is ${f.PCT_OF_MAX}% of max size (${f.CURRENT_MB}MB/${f.MAX_MB}MB). ` +
        `Extend or add new datafile to ${f.TABLESPACE_NAME}.`
      );
    }
  }

  return { focus, data, recommendations };
}

// Radek Oracle MCP — analyze_dataguard tool

import { multiQuery } from './db';
import { dataguardQueries as Q } from '../queries/dataguard';

export async function analyze_dataguard(dbUrl: string): Promise<Record<string, unknown>> {
  const data = await multiQuery(dbUrl, {
    database_role:    Q.database_role,
    managed_standby:  Q.managed_standby,
    dataguard_stats:  Q.dataguard_stats,
    archive_dest:     Q.archive_dest,
    archive_dest_status: Q.archive_dest_status,
  });

  const recommendations: string[] = [];

  // Check database role
  type DbRow = { DATABASE_ROLE: string; PROTECTION_MODE: string; SWITCHOVER_STATUS: string };
  const dbRow = (data.database_role as DbRow[])?.[0];

  // Data Guard lag
  type StatsRow = { NAME: string; VALUE: string };
  const dgStats = (data.dataguard_stats as StatsRow[]) ?? [];
  const applyLag = dgStats.find(r => r.NAME === 'apply lag');
  if (applyLag && applyLag.VALUE && applyLag.VALUE !== '+00 00:00:00') {
    recommendations.push(
      `DATA GUARD LAG: Apply lag = ${applyLag.VALUE}. ` +
      `Check standby: SELECT * FROM v$managed_standby; ` +
      `Check archived log delivery to standby.`
    );
  }

  // Inactive destinations
  type DestRow = { STATUS: string; DEST_NAME: string; TARGET: string };
  const dests = (data.archive_dest_status as DestRow[]) ?? [];
  for (const d of dests) {
    if (d.STATUS === 'ERROR' || d.STATUS === 'DEFERRED') {
      recommendations.push(
        `ARCHIVE DEST PROBLEM: ${d.DEST_NAME} (${d.TARGET}) status=${d.STATUS}. ` +
        `Check network and standby connectivity.`
      );
    }
  }

  return { data, recommendations, database_role: dbRow?.DATABASE_ROLE ?? 'UNKNOWN' };
}

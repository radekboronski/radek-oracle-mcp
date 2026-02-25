// Radek Oracle MCP — analyze_redo tool

import { multiQuery } from './db';
import { redoQueries as Q } from '../queries/redo';

export async function analyze_redo(dbUrl: string): Promise<Record<string, unknown>> {
  const data = await multiQuery(dbUrl, {
    log_groups:      Q.log_groups,
    log_files:       Q.log_files,
    switch_frequency:Q.switch_frequency,
    switch_7days:    Q.switch_rate_last7days,
    archivelog:      Q.archivelog_status,
    parameters:      Q.redo_parameters,
    checkpoint:      Q.checkpoint_status,
  });

  const recommendations: string[] = [];

  // Frequent log switches (> 4/hour)
  type SwitchRow = { HOUR: string; SWITCHES: number };
  const switches = (data.switch_frequency as SwitchRow[]) ?? [];
  const maxSwitches = Math.max(...switches.map(r => r.SWITCHES), 0);
  if (maxSwitches > 4) {
    recommendations.push(
      `FREQUENT LOG SWITCHES: up to ${maxSwitches}/hour. ` +
      `Increase redo log size: ALTER DATABASE ADD LOGFILE SIZE 1G; ` +
      `And remove existing small logs after switching.`
    );
  }

  // Inactive logs (need archiving)
  type LogRow = { STATUS: string; GROUP_: number; SIZE_MB: number };
  const logs = (data.log_groups as LogRow[]) ?? [];
  const needsArchive = logs.filter(l => l.STATUS === 'INACTIVE' || l.STATUS === 'UNARCHIVED');
  if (needsArchive.length > 0) {
    recommendations.push(
      `${needsArchive.length} redo log group(s) need archiving. ` +
      `Force archive: ALTER SYSTEM ARCHIVE LOG ALL;`
    );
  }

  return { data, recommendations };
}

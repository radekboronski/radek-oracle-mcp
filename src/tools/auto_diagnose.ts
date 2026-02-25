// Radek Oracle MCP — auto_diagnose orchestrator

import { health_check } from './health';
import { analyze_locks } from './locks';
import { analyze_sessions } from './sessions';
import { analyze_tablespaces } from './tablespaces';
import { analyze_waits } from './waits';
import { analyze_sql } from './performance';
import { analyze_statistics } from './statistics';

export async function auto_diagnose(
  dbUrl: string,
  focus_area?: string
): Promise<Record<string, unknown>> {
  const all = !focus_area || focus_area === 'all';
  const findings: Record<string, unknown> = {};
  const all_recommendations: string[] = [];

  // Always run health check
  const health = await health_check(dbUrl);
  findings.health = health;
  all_recommendations.push(...(health.issues as string[] ?? []));
  all_recommendations.push(...(health.warnings as string[] ?? []));

  // Locks
  if (all || focus_area === 'locks') {
    const locks = await analyze_locks(dbUrl, 'blocking');
    findings.locks = locks;
    all_recommendations.push(...(locks.recommendations as string[] ?? []));
  }

  // Sessions
  if (all || focus_area === 'connections' || focus_area === 'sessions') {
    const sessions = await analyze_sessions(dbUrl, 'summary');
    findings.sessions = sessions;
    all_recommendations.push(...(sessions.recommendations as string[] ?? []));
  }

  // Wait events
  if (all || focus_area === 'performance') {
    const waits = await analyze_waits(dbUrl, 'summary');
    findings.waits = waits;
    all_recommendations.push(...(waits.recommendations as string[] ?? []));
  }

  // SQL performance
  if (all || focus_area === 'performance') {
    const sql = await analyze_sql(dbUrl, 'top_elapsed');
    findings.sql_performance = sql;
    all_recommendations.push(...(sql.recommendations as string[] ?? []));
  }

  // Tablespaces
  if (all) {
    const tablespaces = await analyze_tablespaces(dbUrl, 'usage');
    findings.tablespaces = tablespaces;
    all_recommendations.push(...(tablespaces.recommendations as string[] ?? []));
  }

  // Statistics
  if (all || focus_area === 'performance') {
    const stats = await analyze_statistics(dbUrl, 'stale');
    findings.statistics = stats;
    all_recommendations.push(...(stats.recommendations as string[] ?? []));
  }

  // Deduplicate
  const unique_recommendations = [...new Set(all_recommendations)];

  return {
    summary: {
      health_level: (health.health_level as string) ?? 'UNKNOWN',
      oracle_version: health.oracle_version,
      total_findings: unique_recommendations.length,
    },
    findings,
    recommendations: unique_recommendations,
  };
}

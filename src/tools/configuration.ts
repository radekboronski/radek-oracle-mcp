// Radek Oracle MCP — analyze_configuration tool

import { multiQuery } from './db';
import { configurationQueries as Q } from '../queries/configuration';

export async function analyze_configuration(
  dbUrl: string,
  focus = 'key'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:        ['key_parameters','non_default','security_params','nls_settings'],
    key:        ['key_parameters'],
    non_default:['non_default'],
    security:   ['security_params'],
    nls:        ['nls_settings'],
    all_params: ['all_parameters'],
  };

  const keys = focusMap[focus] ?? focusMap.key;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  type ParamRow = { NAME: string; VALUE: string; ISDEFAULT: string; ISMODIFIED: string };
  const params = (data.key_parameters as ParamRow[]) ?? [];

  const param = (name: string) => params.find(p => p.NAME === name)?.VALUE;

  // cursor_sharing
  const cursorSharing = param('cursor_sharing');
  if (cursorSharing === 'EXACT') {
    recommendations.push(
      `cursor_sharing=EXACT may cause excessive hard parsing if applications use literal SQL. ` +
      `Consider: ALTER SYSTEM SET CURSOR_SHARING = 'FORCE' SCOPE=BOTH;`
    );
  }

  // statistics_level
  const statsLevel = param('statistics_level');
  if (statsLevel === 'BASIC') {
    recommendations.push(
      `statistics_level=BASIC disables many advisors and AWR. ` +
      `Recommended: ALTER SYSTEM SET STATISTICS_LEVEL = 'TYPICAL' SCOPE=BOTH;`
    );
  }

  // audit_trail
  const auditTrail = param('audit_trail');
  if (auditTrail === 'NONE') {
    recommendations.push(
      `audit_trail=NONE. Consider enabling auditing: ALTER SYSTEM SET AUDIT_TRAIL = 'DB' SCOPE=SPFILE; ` +
      `(Requires restart)`
    );
  }

  // recyclebin
  const recyclebin = param('recyclebin');
  if (recyclebin === 'on') {
    recommendations.push(
      `recyclebin=on. Recyclebin objects consume space. ` +
      `Purge: PURGE DBA_RECYCLEBIN; ` +
      `Or disable: ALTER SYSTEM SET RECYCLEBIN = 'OFF' SCOPE=BOTH;`
    );
  }

  return { focus, data, recommendations };
}

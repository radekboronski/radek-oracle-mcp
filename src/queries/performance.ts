// Radek Oracle MCP — SQL performance queries (Oracle 19c)

export const performanceQueries = {

  top_elapsed: `
    SELECT sql_id, child_number, executions,
           ROUND(elapsed_time/1e6, 2) AS elapsed_secs,
           ROUND(elapsed_time/1e6/NULLIF(executions,0), 3) AS avg_elapsed_ms,
           ROUND(cpu_time/1e6, 2) AS cpu_secs,
           buffer_gets, disk_reads, rows_processed,
           ROUND(buffer_gets/NULLIF(executions,0), 0) AS avg_buffer_gets,
           ROUND(disk_reads/NULLIF(executions,0), 0) AS avg_disk_reads,
           parsing_user_id, module, action,
           SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql WHERE executions > 0
    ORDER BY elapsed_time DESC
    FETCH FIRST 25 ROWS ONLY`,

  top_cpu: `
    SELECT sql_id, executions,
           ROUND(cpu_time/1e6, 2) AS cpu_secs,
           ROUND(cpu_time/1e6/NULLIF(executions,0), 3) AS avg_cpu_ms,
           ROUND(elapsed_time/1e6, 2) AS elapsed_secs,
           buffer_gets, disk_reads, module,
           SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql WHERE executions > 0
    ORDER BY cpu_time DESC
    FETCH FIRST 25 ROWS ONLY`,

  top_disk: `
    SELECT sql_id, executions, disk_reads,
           ROUND(disk_reads/NULLIF(executions,0), 0) AS avg_disk_reads,
           buffer_gets, ROUND(elapsed_time/1e6, 2) AS elapsed_secs,
           module, SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql WHERE executions > 0
    ORDER BY disk_reads DESC
    FETCH FIRST 25 ROWS ONLY`,

  top_buffer: `
    SELECT sql_id, executions, buffer_gets,
           ROUND(buffer_gets/NULLIF(executions,0), 0) AS avg_buffer_gets,
           disk_reads, ROUND(elapsed_time/1e6, 2) AS elapsed_secs,
           module, SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql WHERE executions > 0
    ORDER BY buffer_gets DESC
    FETCH FIRST 25 ROWS ONLY`,

  top_executions: `
    SELECT sql_id, executions, ROUND(elapsed_time/1e6, 2) AS total_elapsed_secs,
           ROUND(elapsed_time/1e6/NULLIF(executions,0), 3) AS avg_elapsed_ms,
           ROUND(cpu_time/1e6/NULLIF(executions,0), 3) AS avg_cpu_ms,
           buffer_gets, disk_reads, module,
           SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql WHERE executions > 0
    ORDER BY executions DESC
    FETCH FIRST 25 ROWS ONLY`,

  top_rows: `
    SELECT sql_id, executions, rows_processed,
           ROUND(rows_processed/NULLIF(executions,0), 0) AS avg_rows,
           ROUND(elapsed_time/1e6, 2) AS elapsed_secs,
           buffer_gets, module,
           SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql WHERE executions > 0 AND rows_processed > 0
    ORDER BY rows_processed DESC
    FETCH FIRST 25 ROWS ONLY`,

  full_table_scans: `
    SELECT sql_id, executions, buffer_gets, disk_reads,
           ROUND(elapsed_time/1e6, 2) AS elapsed_secs,
           module, SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql
    WHERE executions > 0
    AND sql_text LIKE '%TABLE ACCESS FULL%'
    ORDER BY elapsed_time DESC
    FETCH FIRST 20 ROWS ONLY`,

  parse_analysis: `
    SELECT ROUND(
      (SELECT value FROM v$sysstat WHERE name = 'parse count (hard)') /
      NULLIF((SELECT value FROM v$sysstat WHERE name = 'parse count (total)'), 0) * 100, 2
    ) AS hard_parse_pct,
    (SELECT value FROM v$sysstat WHERE name = 'parse count (total)') AS total_parses,
    (SELECT value FROM v$sysstat WHERE name = 'parse count (hard)') AS hard_parses,
    (SELECT value FROM v$sysstat WHERE name = 'parse count (failures)') AS failed_parses,
    (SELECT value FROM v$sysstat WHERE name = 'execute count') AS executions
    FROM dual`,

  sql_errors: `
    SELECT sql_id, executions, parse_calls, users_executing,
           loads, invalidations, elapsed_time/1e6 AS elapsed_secs,
           module, SUBSTR(sql_text, 1, 300) AS sql_text
    FROM v$sql
    WHERE loads > executions AND executions > 0
    ORDER BY loads DESC
    FETCH FIRST 20 ROWS ONLY`,

  cursor_efficiency: `
    SELECT (SELECT value FROM v$sysstat WHERE name = 'session cursor cache hits') AS cursor_cache_hits,
           (SELECT value FROM v$sysstat WHERE name = 'parse count (total)') AS total_parses,
           ROUND(
             (SELECT value FROM v$sysstat WHERE name = 'session cursor cache hits') /
             NULLIF((SELECT value FROM v$sysstat WHERE name = 'parse count (total)'), 0) * 100, 2
           ) AS cursor_cache_hit_pct
    FROM dual`,

  shared_pool: `
    SELECT namespace, pins, pinhits,
           ROUND(pinhits/NULLIF(pins,0)*100, 2) AS pin_hit_pct,
           reloads, invalidations
    FROM v$librarycache
    ORDER BY pins DESC`,

  running_sql: `
    SELECT s.sid, s.serial#, s.username, s.status, s.osuser, s.machine,
           ROUND(s.last_call_et) AS elapsed_seconds,
           sq.sql_id, sq.child_number, sq.executions,
           sq.buffer_gets, sq.disk_reads,
           sw.event AS wait_event, sw.wait_class,
           SUBSTR(sq.sql_text, 1, 300) AS sql_text
    FROM v$session s
    JOIN v$sql sq ON s.sql_id = sq.sql_id AND s.sql_child_number = sq.child_number
    LEFT JOIN v$session_wait sw ON s.sid = sw.sid
    WHERE s.status = 'ACTIVE' AND s.type = 'USER'
    ORDER BY s.last_call_et DESC`,

} as const;

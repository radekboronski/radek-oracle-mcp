// Radek Oracle MCP — session analysis queries (Oracle 19c)

export const sessionQueries = {

  all_sessions: `
    SELECT s.sid, s.serial#, s.username, s.status, s.type,
           s.osuser, s.machine, s.program, s.module, s.action,
           s.schemaname, s.service_name,
           TO_CHAR(s.logon_time, 'YYYY-MM-DD HH24:MI:SS') AS logon_time,
           ROUND(s.last_call_et) AS seconds_since_call,
           sw.event AS wait_event, sw.wait_class,
           ROUND(sw.seconds_in_wait) AS seconds_in_wait,
           sw.state AS wait_state,
           SUBSTR(sq.sql_text, 1, 200) AS current_sql
    FROM v$session s
    LEFT JOIN v$session_wait sw ON s.sid = sw.sid
    LEFT JOIN v$sql sq ON s.sql_id = sq.sql_id AND s.sql_child_number = sq.child_number
    WHERE s.type = 'USER'
    ORDER BY s.status, s.last_call_et DESC
    FETCH FIRST 100 ROWS ONLY`,

  active_sessions: `
    SELECT s.sid, s.serial#, s.username, s.osuser, s.machine, s.program,
           s.module, s.action, ROUND(s.last_call_et) AS elapsed_seconds,
           sw.event AS wait_event, sw.wait_class,
           sq.sql_id, SUBSTR(sq.sql_text, 1, 300) AS sql_text,
           sq.executions, sq.elapsed_time/1e6 AS sql_elapsed_secs,
           sq.buffer_gets, sq.disk_reads
    FROM v$session s
    JOIN v$session_wait sw ON s.sid = sw.sid
    LEFT JOIN v$sql sq ON s.sql_id = sq.sql_id AND s.sql_child_number = sq.child_number
    WHERE s.status = 'ACTIVE' AND s.type = 'USER'
    ORDER BY s.last_call_et DESC`,

  long_running: `
    SELECT s.sid, s.serial#, s.username, s.osuser, s.machine,
           ROUND(s.last_call_et) AS elapsed_seconds,
           sw.event AS wait_event, sw.wait_class,
           SUBSTR(sq.sql_text, 1, 300) AS sql_text,
           sq.sql_id, sq.executions, sq.buffer_gets, sq.disk_reads
    FROM v$session s
    LEFT JOIN v$session_wait sw ON s.sid = sw.sid
    LEFT JOIN v$sql sq ON s.sql_id = sq.sql_id AND s.sql_child_number = sq.child_number
    WHERE s.status = 'ACTIVE' AND s.type = 'USER'
    AND s.last_call_et > 30
    ORDER BY s.last_call_et DESC`,

  long_operations: `
    SELECT sid, serial#, opname, target, target_desc,
           sofar, totalwork,
           ROUND(sofar/NULLIF(totalwork,0)*100, 1) AS pct_complete,
           elapsed_seconds, time_remaining, message,
           TO_CHAR(start_time, 'YYYY-MM-DD HH24:MI:SS') AS start_time
    FROM v$session_longops
    WHERE totalwork > 0 AND sofar < totalwork
    ORDER BY elapsed_seconds DESC`,

  by_user: `
    SELECT username, COUNT(*) AS total_sessions,
           SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive,
           MAX(ROUND(last_call_et)) AS max_idle_secs
    FROM v$session
    WHERE type = 'USER' AND username IS NOT NULL
    GROUP BY username ORDER BY total_sessions DESC`,

  by_machine: `
    SELECT machine, COUNT(*) AS total_sessions,
           SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
           COUNT(DISTINCT username) AS users
    FROM v$session
    WHERE type = 'USER'
    GROUP BY machine ORDER BY total_sessions DESC`,

  by_program: `
    SELECT program, COUNT(*) AS sessions,
           SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
           COUNT(DISTINCT username) AS users
    FROM v$session
    WHERE type = 'USER'
    GROUP BY program ORDER BY sessions DESC
    FETCH FIRST 20 ROWS ONLY`,

  session_limits: `
    SELECT resource_name, current_utilization, max_utilization, limit_value
    FROM v$resource_limit
    WHERE resource_name IN ('sessions','processes','enqueue_locks','enqueue_resources',
                            'ges_procs','ges_ress','transactions')
    ORDER BY resource_name`,

  sleeping: `
    SELECT s.sid, s.serial#, s.username, s.osuser, s.machine, s.program,
           ROUND(s.last_call_et) AS idle_seconds,
           TO_CHAR(s.logon_time, 'YYYY-MM-DD HH24:MI:SS') AS logon_time
    FROM v$session s
    WHERE s.status = 'INACTIVE' AND s.type = 'USER'
    ORDER BY s.last_call_et DESC
    FETCH FIRST 50 ROWS ONLY`,

} as const;

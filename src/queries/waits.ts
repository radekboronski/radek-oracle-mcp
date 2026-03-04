// Radek Oracle MCP — wait event analysis queries (Oracle 19c)

export const waitQueries = {

  system_events: `
    SELECT event, wait_class, total_waits, total_timeouts,
           ROUND(time_waited/100, 2) AS time_waited_secs,
           ROUND(time_waited/NULLIF(total_waits,0)/100, 3) AS avg_wait_ms,
           ROUND(time_waited/NULLIF(
             (SELECT SUM(time_waited) FROM v$system_event WHERE wait_class != 'Idle'), 0
           ) * 100, 1) AS pct_of_total_wait
    FROM v$system_event
    WHERE wait_class NOT IN ('Idle')
    ORDER BY time_waited DESC
    FETCH FIRST 30 ROWS ONLY`,

  wait_classes: `
    SELECT wait_class, COUNT(*) AS event_count,
           SUM(total_waits) AS total_waits,
           ROUND(SUM(time_waited)/100, 2) AS total_secs,
           ROUND(SUM(time_waited)/NULLIF(SUM(total_waits),0)/100, 3) AS avg_ms
    FROM v$system_event
    WHERE wait_class NOT IN ('Idle')
    GROUP BY wait_class
    ORDER BY total_secs DESC`,

  current_waits: `
    SELECT s.sid, s.serial#, s.username, s.status,
           sw.event, sw.wait_class, sw.state,
           ROUND(sw.seconds_in_wait) AS seconds_in_wait,
           sw.wait_time, s.machine, s.program, s.module
    FROM v$session_wait sw
    JOIN v$session s ON sw.sid = s.sid
    WHERE s.type = 'USER' AND sw.wait_class != 'Idle'
    ORDER BY sw.seconds_in_wait DESC
    FETCH FIRST 50 ROWS ONLY`,

  io_waits: `
    SELECT event, total_waits,
           ROUND(time_waited/100, 2) AS time_waited_secs,
           ROUND(time_waited/NULLIF(total_waits,0)/100, 3) AS avg_ms
    FROM v$system_event
    WHERE wait_class IN ('User I/O','System I/O')
    ORDER BY time_waited DESC`,

  concurrency_waits: `
    SELECT event, total_waits, total_timeouts,
           ROUND(time_waited/100, 2) AS time_waited_secs,
           ROUND(time_waited/NULLIF(total_waits,0)/100, 3) AS avg_ms
    FROM v$system_event
    WHERE wait_class IN ('Concurrency','Application','Cluster')
    ORDER BY time_waited DESC`,

  enqueue_waits: `
    SELECT eq_name, req_reason,
           total_req#, total_wait#, succ_req#, failed_req#,
           ROUND(cum_wait_time/1000, 2) AS wait_secs
    FROM v$enqueue_statistics
    WHERE total_wait# > 0
    ORDER BY cum_wait_time DESC
    FETCH FIRST 20 ROWS ONLY`,

  latch_misses: `
    SELECT l.name AS latch_name, l.gets, l.misses,
           ROUND(l.misses/NULLIF(l.gets,0)*100, 3) AS miss_pct,
           l.sleeps, l.wait_time/1000 AS wait_ms
    FROM v$latch l
    WHERE l.misses > 0
    ORDER BY l.misses DESC
    FETCH FIRST 20 ROWS ONLY`,

  session_waits_history: `
    SELECT event, wait_class, COUNT(*) AS cnt,
           SUM(time_waited)/100 AS total_secs,
           MAX(time_waited)/100 AS max_secs
    FROM v$session_event
    WHERE wait_class != 'Idle' AND time_waited > 0
    GROUP BY event, wait_class
    ORDER BY total_secs DESC
    FETCH FIRST 30 ROWS ONLY`,

  ash_recent: `
    SELECT TO_CHAR(sample_time, 'YYYY-MM-DD HH24:MI:SS') AS sample_time,
           session_id, session_serial#, user_id, program, module,
           event, wait_class, sql_id, session_state
    FROM v$active_session_history
    WHERE sample_time > SYSDATE - INTERVAL '10' MINUTE
    ORDER BY sample_time DESC
    FETCH FIRST 100 ROWS ONLY`,

} as const;

// Radek Oracle MCP — undo analysis queries (Oracle 19c)

export const undoQueries = {

  undo_stats: `
    SELECT TO_CHAR(begin_time, 'YYYY-MM-DD HH24:MI:SS') AS begin_time,
           TO_CHAR(end_time, 'YYYY-MM-DD HH24:MI:SS') AS end_time,
           undoblks, txncount, maxquerylen, maxconcurrency,
           ssolderrcnt AS snapshot_too_old_errs,
           nospaceerrcnt AS no_space_errs,
           activeblks, unexpiredblks, expiredblks,
           ROUND(activeblks * (
             SELECT TO_NUMBER(value) FROM v$parameter WHERE name = 'db_block_size'
           ) / 1024 / 1024, 2) AS active_mb
    FROM v$undostat
    ORDER BY begin_time DESC
    FETCH FIRST 20 ROWS ONLY`,

  undo_parameters: `
    SELECT name, value, description
    FROM v$parameter
    WHERE name IN ('undo_management','undo_tablespace','undo_retention',
                   'undo_suppress_errors')
    ORDER BY name`,

  undo_segments: `
    SELECT s.owner, s.segment_name, s.tablespace_name,
           s.status, ROUND(s.bytes/1024/1024, 2) AS size_mb,
           s.extents, s.blocks
    FROM dba_segments s
    WHERE s.segment_type = 'TYPE2 UNDO'
    ORDER BY s.bytes DESC`,

  undo_usage: `
    SELECT r.usn, r.name, rs.status,
           rs.extents, ROUND(rs.rssize/1024/1024, 2) AS size_mb,
           rs.writes, rs.hwmsize/1024/1024 AS hwm_mb,
           rs.xacts, rs.gets, rs.waits,
           ROUND(rs.waits/NULLIF(rs.gets,0)*100, 4) AS wait_pct,
           rs.shrinks, rs.wraps
    FROM v$rollname r
    JOIN v$rollstat rs ON r.usn = rs.usn
    ORDER BY rs.rssize DESC`,

  long_running_queries: `
    SELECT t.start_scnb, t.start_time,
           ROUND((SYSDATE - t.start_time) * 24 * 60, 0) AS running_minutes,
           t.used_ublk, t.used_urec,
           s.sid, s.serial#, s.username, s.status,
           SUBSTR(sq.sql_text, 1, 200) AS sql_text
    FROM v$transaction t
    JOIN v$session s ON t.ses_addr = s.saddr
    LEFT JOIN v$sql sq ON s.sql_id = sq.sql_id
    ORDER BY t.start_time`,

} as const;

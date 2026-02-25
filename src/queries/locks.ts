// Radek Oracle MCP — lock analysis queries (Oracle 19c)

export const lockQueries = {

  blocking_sessions: `
    SELECT DISTINCT
      b.sid AS blocking_sid, b.serial# AS blocking_serial,
      bs.username AS blocking_user, bs.osuser AS blocking_osuser,
      bs.machine AS blocking_machine, bs.program AS blocking_program,
      bs.status AS blocking_status,
      ROUND(bs.last_call_et) AS blocking_seconds,
      bsq.sql_text AS blocking_sql
    FROM v$lock b
    JOIN v$session bs ON b.sid = bs.sid
    LEFT JOIN v$sql bsq ON bs.sql_id = bsq.sql_id AND bs.sql_child_number = bsq.child_number
    WHERE b.block = 1
    ORDER BY blocking_seconds DESC`,

  waiting_sessions: `
    SELECT
      w.sid AS waiting_sid, ws.serial# AS waiting_serial,
      ws.username AS waiting_user, ws.osuser AS waiting_osuser,
      ws.machine AS waiting_machine,
      b.sid AS blocking_sid, bs.username AS blocking_user,
      w.type AS lock_type,
      obj.object_name, obj.object_type,
      ROUND(ws.last_call_et) AS wait_seconds,
      wsq.sql_text AS waiting_sql
    FROM v$lock w
    JOIN v$lock b ON w.id1 = b.id1 AND w.id2 = b.id2 AND b.block = 1
    JOIN v$session ws ON w.sid = ws.sid
    JOIN v$session bs ON b.sid = bs.sid
    LEFT JOIN dba_objects obj ON w.id1 = obj.object_id
    LEFT JOIN v$sql wsq ON ws.sql_id = wsq.sql_id AND ws.sql_child_number = wsq.child_number
    WHERE w.block = 0 AND w.request > 0
    ORDER BY wait_seconds DESC`,

  all_locks: `
    SELECT l.sid, s.serial#, s.username, s.status, l.type,
           l.id1, l.id2, l.lmode, l.request, l.block,
           DECODE(l.lmode,0,'None',1,'Null',2,'Row-S(SS)',3,'Row-X(SX)',4,'Share',5,'S/Row-X(SSX)',6,'Exclusive','?') AS lock_mode,
           DECODE(l.request,0,'None',1,'Null',2,'Row-S',3,'Row-X',4,'Share',5,'S/Row-X',6,'Exclusive','?') AS request_mode,
           obj.object_name, obj.object_type
    FROM v$lock l
    JOIN v$session s ON l.sid = s.sid
    LEFT JOIN dba_objects obj ON l.id1 = obj.object_id
    WHERE s.type = 'USER'
    ORDER BY l.block DESC, l.sid`,

  active_transactions: `
    SELECT t.addr, t.xidusn, t.xidslot, t.xidsqn,
           t.status, t.start_scnb, t.used_ublk, t.used_urec,
           ROUND(t.used_ublk * (
             SELECT TO_NUMBER(value) FROM v$parameter WHERE name = 'db_block_size'
           ) / 1024, 0) AS undo_kb,
           s.sid, s.serial#, s.username, s.osuser, s.machine,
           TO_CHAR(t.start_time, 'YYYY-MM-DD HH24:MI:SS') AS start_time
    FROM v$transaction t
    JOIN v$session s ON t.ses_addr = s.saddr
    ORDER BY t.start_time`,

  ddl_locks: `
    SELECT o.session_id AS sid, o.oracle_username, o.os_user_name,
           o.object, o.type, o.mode_held, o.mode_requested
    FROM dba_ddl_locks o
    WHERE o.mode_held != 'None' OR o.mode_requested != 'None'
    ORDER BY o.session_id`,

  deadlock_trace: `
    SELECT value AS trace_dir FROM v$parameter WHERE name = 'background_dump_dest'`,

} as const;

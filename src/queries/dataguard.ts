// Radek Oracle MCP — Data Guard analysis queries (Oracle 19c)

export const dataguardQueries = {

  managed_standby: `
    SELECT process, status, client_process, client_pid,
           thread#, sequence#, block#, blocks,
           delay_mins, target, archiver, schedule,
           TO_CHAR(SYSTIMESTAMP, 'YYYY-MM-DD HH24:MI:SS') AS checked_at
    FROM v$managed_standby
    ORDER BY process`,

  dataguard_stats: `
    SELECT name, value, unit, time_computed, datum_time
    FROM v$dataguard_stats
    ORDER BY name`,

  archive_dest: `
    SELECT dest_id, dest_name, status, target, archiver, schedule,
           destination, log_sequence, reopen_secs, max_failure,
           net_timeout, db_unique_name, role_limit, protection_mode
    FROM v$archive_dest
    WHERE status != 'INACTIVE'
    ORDER BY dest_id`,

  archive_dest_status: `
    SELECT dest_id, dest_name, status, target, database_mode, recovery_mode,
           protection_mode, gap_status, db_unique_name, synchronization_status,
           synchronized
    FROM v$archive_dest_status
    WHERE status != 'INACTIVE'
    ORDER BY dest_id`,

  database_role: `
    SELECT name, db_unique_name, database_role,
           protection_mode, protection_level,
           switchover_status, dataguard_broker, guard_status,
           standby_became_primary_scn, fs_failover_status,
           fs_failover_current_target
    FROM v$database`,

  redo_transport: `
    SELECT inst_id, dest_id, archived_seq#, applied_seq#,
           blocks, gap_status
    FROM gv$archive_dest_status
    WHERE status != 'INACTIVE'
    ORDER BY inst_id, dest_id`,

} as const;

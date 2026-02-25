// Radek Oracle MCP — redo log analysis queries (Oracle 19c)

export const redoQueries = {

  log_groups: `
    SELECT group#, sequence#,
           ROUND(bytes/1024/1024, 2) AS size_mb,
           members, status, archived,
           TO_CHAR(first_time, 'YYYY-MM-DD HH24:MI:SS') AS first_time,
           TO_CHAR(next_time, 'YYYY-MM-DD HH24:MI:SS') AS next_time,
           first_change#, next_change#
    FROM v$log ORDER BY group#`,

  log_files: `
    SELECT group#, status, type, member, is_recovery_dest_file
    FROM v$logfile ORDER BY group#, member`,

  switch_frequency: `
    SELECT TO_CHAR(TRUNC(first_time, 'HH24'), 'YYYY-MM-DD HH24:00') AS hour,
           COUNT(*) AS switches,
           ROUND(COUNT(*) * (
             SELECT bytes/1024/1024 FROM v$log WHERE rownum = 1
           ), 0) AS redo_mb_generated
    FROM v$log_history
    WHERE first_time > SYSDATE - 1
    GROUP BY TRUNC(first_time, 'HH24')
    ORDER BY hour`,

  switch_rate_last7days: `
    SELECT TO_CHAR(TRUNC(first_time), 'YYYY-MM-DD') AS day,
           COUNT(*) AS total_switches
    FROM v$log_history
    WHERE first_time > SYSDATE - 7
    GROUP BY TRUNC(first_time)
    ORDER BY day`,

  archivelog_status: `
    SELECT log_mode, archiver FROM v$database, v$instance`,

  archived_logs: `
    SELECT name, sequence#, dest_id, archived, applied, deleted,
           ROUND(blocks * block_size / 1024 / 1024, 2) AS size_mb,
           TO_CHAR(first_time, 'YYYY-MM-DD HH24:MI:SS') AS first_time,
           TO_CHAR(completion_time, 'YYYY-MM-DD HH24:MI:SS') AS completion_time
    FROM v$archived_log
    WHERE first_time > SYSDATE - 1
    ORDER BY first_time DESC
    FETCH FIRST 50 ROWS ONLY`,

  redo_parameters: `
    SELECT name, value
    FROM v$parameter
    WHERE name IN ('log_buffer','log_checkpoint_interval','log_checkpoint_timeout',
                   'db_recovery_file_dest','db_recovery_file_dest_size',
                   'log_archive_dest_1','log_archive_format',
                   'archive_lag_target','log_archive_max_processes')
    ORDER BY name`,

  checkpoint_status: `
    SELECT file#, status, checkpoint_change#, checkpoint_time,
           TO_CHAR(checkpoint_time, 'YYYY-MM-DD HH24:MI:SS') AS checkpoint_dt
    FROM v$datafile_header ORDER BY file#`,

} as const;

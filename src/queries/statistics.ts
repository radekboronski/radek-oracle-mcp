// Radek Oracle MCP — optimizer statistics queries (Oracle 19c)

export const statisticsQueries = {

  table_stats: `
    SELECT owner, table_name, num_rows, blocks, avg_row_len,
           sample_size, TO_CHAR(last_analyzed, 'YYYY-MM-DD HH24:MI:SS') AS last_analyzed,
           stattype_locked, stale_stats
    FROM dba_tab_statistics
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY last_analyzed NULLS FIRST
    FETCH FIRST 100 ROWS ONLY`,

  stale_stats: `
    SELECT owner, table_name, num_rows, last_analyzed,
           ROUND(SYSDATE - last_analyzed) AS days_stale,
           stale_stats, stattype_locked
    FROM dba_tab_statistics
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND (stale_stats = 'YES' OR last_analyzed IS NULL
         OR last_analyzed < SYSDATE - 7)
    ORDER BY days_stale DESC NULLS FIRST`,

  index_stats: `
    SELECT owner, index_name, table_name,
           num_rows, distinct_keys, leaf_blocks,
           avg_leaf_blocks_per_key, avg_data_blocks_per_key,
           clustering_factor, sample_size,
           TO_CHAR(last_analyzed, 'YYYY-MM-DD HH24:MI:SS') AS last_analyzed
    FROM dba_ind_statistics
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY last_analyzed NULLS FIRST
    FETCH FIRST 100 ROWS ONLY`,

  column_stats: `
    SELECT owner, table_name, column_name, num_distinct, num_nulls,
           density, num_buckets, histogram,
           ROUND(num_nulls/NULLIF(num_rows,0)*100,1) AS null_pct,
           TO_CHAR(last_analyzed, 'YYYY-MM-DD HH24:MI:SS') AS last_analyzed
    FROM dba_tab_col_statistics c
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY c.last_analyzed NULLS FIRST
    FETCH FIRST 100 ROWS ONLY`,

  pending_stats: `
    SELECT owner, table_name, num_rows, blocks,
           TO_CHAR(last_analyzed, 'YYYY-MM-DD HH24:MI:SS') AS last_analyzed
    FROM dba_tab_pending_stats
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB')
    ORDER BY owner, table_name`,

  gather_stats_job: `
    SELECT job_name, state, enabled,
           TO_CHAR(last_start_date, 'YYYY-MM-DD HH24:MI:SS') AS last_run,
           TO_CHAR(next_run_date, 'YYYY-MM-DD HH24:MI:SS') AS next_run
    FROM dba_scheduler_jobs
    WHERE job_name = 'GATHER_STATS_JOB'
    UNION ALL
    SELECT job_name, state, enabled,
           TO_CHAR(last_start_date, 'YYYY-MM-DD HH24:MI:SS'),
           TO_CHAR(next_run_date, 'YYYY-MM-DD HH24:MI:SS')
    FROM dba_scheduler_jobs
    WHERE job_name = 'AUTO_SPACE_ADVISOR_JOB'`,

  optimizer_parameters: `
    SELECT name, value, description, isdefault
    FROM v$parameter
    WHERE name IN (
      'optimizer_mode','optimizer_features_enable','optimizer_index_cost_adj',
      'optimizer_index_caching','optimizer_use_pending_statistics',
      'optimizer_adaptive_features','optimizer_adaptive_plans',
      'optimizer_adaptive_statistics','optimizer_real_application_testing',
      'db_file_multiblock_read_count','cursor_sharing',
      'statistics_level','timed_statistics'
    )
    ORDER BY name`,

} as const;

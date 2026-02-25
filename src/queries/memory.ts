// Radek Oracle MCP — memory analysis queries (Oracle 19c)

export const memoryQueries = {

  sga_components: `
    SELECT component, current_size/1024/1024 AS current_mb,
           min_size/1024/1024 AS min_mb,
           max_size/1024/1024 AS max_mb,
           user_specified_size/1024/1024 AS configured_mb,
           oper_count, last_oper_type, last_oper_mode
    FROM v$sga_dynamic_components
    ORDER BY current_size DESC`,

  sga_detail: `
    SELECT pool, name, bytes/1024/1024 AS mb
    FROM v$sgastat
    ORDER BY bytes DESC
    FETCH FIRST 30 ROWS ONLY`,

  pga_stats: `
    SELECT name, ROUND(value/1024/1024, 2) AS mb
    FROM v$pgastat ORDER BY value DESC`,

  pga_histogram: `
    SELECT low_optimal_size/1024 AS low_kb,
           high_optimal_size/1024 AS high_kb,
           optimal_executions, onepass_executions, multipasses_executions
    FROM v$sql_workarea_histogram
    WHERE (optimal_executions + onepass_executions + multipasses_executions) > 0
    ORDER BY low_optimal_size`,

  memory_parameters: `
    SELECT name, value, description, isdefault, ismodified
    FROM v$parameter
    WHERE name IN (
      'sga_target','sga_max_size','pga_aggregate_target','pga_aggregate_limit',
      'memory_target','memory_max_target','db_cache_size','db_keep_cache_size',
      'db_recycle_cache_size','shared_pool_size','shared_pool_reserved_size',
      'large_pool_size','java_pool_size','streams_pool_size','log_buffer'
    )
    ORDER BY name`,

  buffer_pool_stats: `
    SELECT name, block_size, set_msize/1024 AS size_kb,
           cnum_repl, cnum_write, cnum_set, buf_got, sum_write,
           ROUND(1 - (sum_write/NULLIF(buf_got,0)),4) AS efficiency
    FROM v$buffer_pool_statistics
    ORDER BY set_msize DESC`,

  db_cache_advisory: `
    SELECT size_for_estimate/1024/1024 AS size_mb,
           buffers_for_estimate,
           estd_physical_read_factor,
           estd_physical_reads
    FROM v$db_cache_advice
    WHERE name = 'DEFAULT' AND block_size = (
      SELECT TO_NUMBER(value) FROM v$parameter WHERE name = 'db_block_size'
    )
    ORDER BY size_for_estimate`,

  shared_pool_advisory: `
    SELECT shared_pool_size_for_estimate/1024/1024 AS size_mb,
           estd_lc_size/1024/1024 AS estd_lc_mb,
           estd_lc_time_saved_factor, estd_lc_load_time
    FROM v$shared_pool_advice
    ORDER BY shared_pool_size_for_estimate`,

  pga_advisory: `
    SELECT pga_target_for_estimate/1024/1024 AS pga_mb,
           estd_pga_cache_hit_percentage,
           estd_overalloc_count
    FROM v$pga_target_advice
    ORDER BY pga_target_for_estimate`,

  sort_overflow: `
    SELECT (SELECT value FROM v$sysstat WHERE name = 'sorts (disk)') AS disk_sorts,
           (SELECT value FROM v$sysstat WHERE name = 'sorts (memory)') AS memory_sorts,
           ROUND(
             (SELECT value FROM v$sysstat WHERE name = 'sorts (disk)') /
             NULLIF((SELECT value FROM v$sysstat WHERE name = 'sorts (disk)') +
                    (SELECT value FROM v$sysstat WHERE name = 'sorts (memory)'), 0) * 100, 2
           ) AS disk_sort_pct
    FROM dual`,

} as const;

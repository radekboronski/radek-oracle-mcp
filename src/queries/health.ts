// Radek Oracle MCP — health check queries (Oracle 19c)

export const healthQueries = {

  database: `
    SELECT name, db_unique_name, created, open_mode, database_role,
           log_mode, platform_name, cdb, con_id
    FROM v$database`,

  instance: `
    SELECT instance_name, host_name, version, version_full,
           TO_CHAR(startup_time, 'YYYY-MM-DD HH24:MI:SS') AS startup_time,
           status, archiver, database_status, instance_role
    FROM v$instance`,

  sga: `
    SELECT name, ROUND(value/1024/1024, 2) AS mb
    FROM v$sga ORDER BY value DESC`,

  pga: `
    SELECT name, ROUND(value/1024/1024, 2) AS mb
    FROM v$pgastat
    WHERE name IN ('total PGA inuse','total PGA allocated','maximum PGA allocated',
                   'total PGA used for auto workareas','cache hit percentage')`,

  sessions: `
    SELECT COUNT(*) AS total_sessions,
           SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
           SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive,
           SUM(CASE WHEN type = 'BACKGROUND' THEN 1 ELSE 0 END) AS background
    FROM v$session`,

  buffer_cache_hit: `
    SELECT ROUND(
      (1 - (
        SELECT value FROM v$sysstat WHERE name = 'physical reads'
      ) / NULLIF(
        (SELECT value FROM v$sysstat WHERE name = 'db block gets') +
        (SELECT value FROM v$sysstat WHERE name = 'consistent gets'), 0
      )) * 100, 2) AS buffer_cache_hit_pct
    FROM dual`,

  library_cache_hit: `
    SELECT ROUND(SUM(pinhits) / NULLIF(SUM(pins), 0) * 100, 2) AS library_cache_hit_pct,
           ROUND(SUM(reloads) / NULLIF(SUM(pins), 0) * 100, 4) AS reload_ratio_pct
    FROM v$librarycache`,

  sysstat_key: `
    SELECT name, value
    FROM v$sysstat
    WHERE name IN (
      'physical reads','physical writes','redo writes','redo size',
      'user calls','execute count','parse count (total)','parse count (hard)',
      'sorts (disk)','sorts (memory)','table scans (long tables)',
      'full index scans','fast full index scans',
      'db block gets','consistent gets','session logical reads'
    )
    ORDER BY name`,

  tablespace_summary: `
    SELECT t.tablespace_name, t.contents, t.status,
           ROUND(SUM(df.bytes)/1024/1024, 2) AS total_mb,
           ROUND(NVL(SUM(fs.bytes), 0)/1024/1024, 2) AS free_mb,
           ROUND((1 - NVL(SUM(fs.bytes),0)/NULLIF(SUM(df.bytes),0)) * 100, 1) AS pct_used
    FROM dba_tablespaces t
    JOIN dba_data_files df ON t.tablespace_name = df.tablespace_name
    LEFT JOIN dba_free_space fs ON t.tablespace_name = fs.tablespace_name
    GROUP BY t.tablespace_name, t.contents, t.status
    ORDER BY pct_used DESC NULLS LAST`,

  wait_events_top: `
    SELECT event, wait_class, total_waits,
           ROUND(time_waited/100, 2) AS time_waited_secs,
           ROUND(time_waited/NULLIF(total_waits,0)/100, 3) AS avg_wait_ms
    FROM v$system_event
    WHERE wait_class NOT IN ('Idle','Administrative','Configuration')
    ORDER BY time_waited DESC
    FETCH FIRST 10 ROWS ONLY`,

  active_locks: `
    SELECT COUNT(*) AS blocking_count
    FROM v$lock WHERE block = 1`,

  invalid_objects: `
    SELECT COUNT(*) AS invalid_count
    FROM dba_objects
    WHERE status = 'INVALID'
    AND owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                      'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS')`,

  redo_log_status: `
    SELECT group#, sequence#, bytes/1024/1024 AS size_mb, members, status, archived
    FROM v$log ORDER BY group#`,

} as const;

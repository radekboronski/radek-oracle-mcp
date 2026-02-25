// Radek Oracle MCP — table analysis queries (Oracle 19c)

export const tableQueries = {

  sizes: `
    SELECT s.owner, s.segment_name AS table_name,
           ROUND(s.bytes/1024/1024, 2) AS segment_mb,
           s.blocks, s.extents, s.tablespace_name
    FROM dba_segments s
    WHERE s.segment_type = 'TABLE'
    AND s.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY s.bytes DESC
    FETCH FIRST 50 ROWS ONLY`,

  stats: `
    SELECT owner, table_name, num_rows, blocks, avg_row_len,
           TO_CHAR(last_analyzed, 'YYYY-MM-DD HH24:MI:SS') AS last_analyzed,
           partitioned, row_movement, compression, compress_for,
           monitoring, logging
    FROM dba_tables
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY num_rows DESC NULLS LAST
    FETCH FIRST 50 ROWS ONLY`,

  stale_stats: `
    SELECT t.owner, t.table_name, t.num_rows, t.last_analyzed,
           ROUND(SYSDATE - t.last_analyzed) AS days_since_analyzed,
           ts.stale_stats
    FROM dba_tables t
    JOIN dba_tab_statistics ts ON t.owner = ts.owner AND t.table_name = ts.table_name
    WHERE t.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                          'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND (ts.stale_stats = 'YES' OR t.last_analyzed IS NULL
         OR t.last_analyzed < SYSDATE - 7)
    ORDER BY days_since_analyzed DESC NULLS FIRST
    FETCH FIRST 50 ROWS ONLY`,

  partitioned: `
    SELECT owner, table_name, partitioning_type, subpartitioning_type,
           partition_count, def_subpartition_count,
           interval, is_nested, def_compression
    FROM dba_part_tables
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, table_name`,

  partitions_detail: `
    SELECT table_owner, table_name, partition_name, partition_position,
           high_value, num_rows, blocks, last_analyzed
    FROM dba_tab_partitions
    WHERE table_owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                              'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY table_owner, table_name, partition_position
    FETCH FIRST 100 ROWS ONLY`,

  without_stats: `
    SELECT owner, table_name, num_rows, last_analyzed
    FROM dba_tables
    WHERE last_analyzed IS NULL
    AND owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                      'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, table_name`,

  hot_tables_io: `
    SELECT o.owner, o.object_name AS table_name,
           s.physical_reads, s.physical_writes,
           s.physical_reads_direct, s.logical_reads,
           s.db_block_changes
    FROM v$segment_statistics s
    JOIN dba_objects o ON s.obj# = o.object_id
    WHERE s.statistic_name IN ('physical reads','physical writes','logical reads')
    AND s.value > 0
    AND o.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS')
    ORDER BY s.value DESC
    FETCH FIRST 20 ROWS ONLY`,

  row_counts: `
    SELECT owner, table_name, num_rows
    FROM dba_tables
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND num_rows IS NOT NULL
    ORDER BY num_rows DESC
    FETCH FIRST 50 ROWS ONLY`,

} as const;

// Radek Oracle MCP — storage analysis queries (Oracle 19c)

export const storageQueries = {

  by_schema: `
    SELECT owner, segment_type, COUNT(*) AS objects,
           ROUND(SUM(bytes)/1024/1024, 2) AS total_mb
    FROM dba_segments
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    GROUP BY owner, segment_type
    ORDER BY total_mb DESC`,

  largest_segments: `
    SELECT owner, segment_name, segment_type, tablespace_name,
           ROUND(bytes/1024/1024, 2) AS size_mb, blocks, extents
    FROM dba_segments
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY bytes DESC
    FETCH FIRST 50 ROWS ONLY`,

  datafile_io: `
    SELECT df.name AS file_name, io.file#,
           io.phyrds, io.phywrts,
           ROUND(io.readtim/100, 2) AS read_secs,
           ROUND(io.writetim/100, 2) AS write_secs,
           ROUND(io.readtim/NULLIF(io.phyrds,0)/100, 3) AS avg_read_ms,
           ROUND(io.writetim/NULLIF(io.phywrts,0)/100, 3) AS avg_write_ms,
           io.avgiotim, io.lstiotim, io.miniotim, io.maxiortm, io.maxiowtm
    FROM v$filestat io
    JOIN v$datafile df ON io.file# = df.file#
    ORDER BY io.phyrds + io.phywrts DESC`,

  temp_usage: `
    SELECT tu.username, tu.session_addr, tu.session_num,
           tu.sqladdr, tu.sqlhash,
           tu.tablespace,
           ROUND(tu.blocks * (
             SELECT TO_NUMBER(value) FROM v$parameter WHERE name = 'db_block_size'
           ) / 1024 / 1024, 2) AS used_mb,
           tu.segtype
    FROM v$tempseg_usage tu
    ORDER BY tu.blocks DESC`,

  redo_log_size: `
    SELECT SUM(bytes/1024/1024) AS total_redo_mb, COUNT(*) AS log_files
    FROM v$log`,

  archive_dest_usage: `
    SELECT dest_name, target, archiver, status,
           ROUND(space_used/1024/1024/1024, 2) AS used_gb,
           ROUND(space_limit/1024/1024/1024, 2) AS limit_gb
    FROM v$archive_dest
    WHERE status = 'VALID' OR status = 'WARNING'`,

  extent_fragmentation: `
    SELECT owner, segment_name, segment_type,
           extents, blocks, initial_extent,
           CASE WHEN extents > 1000 THEN 'HIGH_FRAGMENTATION'
                WHEN extents > 100 THEN 'MEDIUM'
                ELSE 'OK' END AS status
    FROM dba_segments
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND extents > 100
    ORDER BY extents DESC
    FETCH FIRST 50 ROWS ONLY`,

  table_fragmentation: `
    SELECT t.owner, t.table_name,
           t.num_rows, t.blocks, t.empty_blocks,
           ROUND(t.empty_blocks/NULLIF(t.blocks + t.empty_blocks, 0)*100, 1) AS empty_pct,
           t.avg_row_len, t.pct_free,
           s.bytes/1024/1024 AS actual_mb,
           ROUND(t.num_rows * t.avg_row_len / 1024 / 1024, 2) AS data_mb
    FROM dba_tables t
    JOIN dba_segments s ON t.owner = s.owner AND t.table_name = s.segment_name
    WHERE t.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                          'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND t.num_rows > 1000
    AND t.blocks IS NOT NULL AND t.empty_blocks IS NOT NULL
    ORDER BY empty_pct DESC NULLS LAST
    FETCH FIRST 50 ROWS ONLY`,

} as const;

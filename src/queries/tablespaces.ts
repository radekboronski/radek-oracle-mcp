// Radek Oracle MCP — tablespace analysis queries (Oracle 19c)

export const tablespaceQueries = {

  usage: `
    SELECT t.tablespace_name, t.contents, t.status, t.logging,
           t.extent_management, t.segment_space_management,
           ROUND(SUM(df.bytes)/1024/1024, 2) AS total_mb,
           ROUND(NVL(SUM(fs.bytes), 0)/1024/1024, 2) AS free_mb,
           ROUND((SUM(df.bytes) - NVL(SUM(fs.bytes), 0))/1024/1024, 2) AS used_mb,
           ROUND((1 - NVL(SUM(fs.bytes),0)/NULLIF(SUM(df.bytes),0)) * 100, 1) AS pct_used,
           t.block_size
    FROM dba_tablespaces t
    JOIN dba_data_files df ON t.tablespace_name = df.tablespace_name
    LEFT JOIN dba_free_space fs ON t.tablespace_name = fs.tablespace_name
    GROUP BY t.tablespace_name, t.contents, t.status, t.logging,
             t.extent_management, t.segment_space_management, t.block_size
    ORDER BY pct_used DESC NULLS LAST`,

  datafiles: `
    SELECT df.tablespace_name, df.file_name, df.file_id,
           ROUND(df.bytes/1024/1024, 2) AS size_mb,
           df.autoextensible, ROUND(df.maxbytes/1024/1024, 2) AS max_mb,
           ROUND(df.increment_by * t.block_size/1024/1024, 2) AS increment_mb,
           df.status, df.online_status
    FROM dba_data_files df
    JOIN dba_tablespaces t ON df.tablespace_name = t.tablespace_name
    ORDER BY df.tablespace_name, df.file_id`,

  free_space: `
    SELECT tablespace_name,
           COUNT(*) AS fragments,
           ROUND(SUM(bytes)/1024/1024, 2) AS total_free_mb,
           ROUND(MAX(bytes)/1024/1024, 2) AS largest_free_chunk_mb,
           ROUND(AVG(bytes)/1024/1024, 2) AS avg_chunk_mb
    FROM dba_free_space
    GROUP BY tablespace_name
    ORDER BY total_free_mb`,

  temp_tablespace: `
    SELECT tf.tablespace_name, tf.file_name,
           ROUND(tf.bytes/1024/1024, 2) AS size_mb,
           tf.autoextensible, ROUND(tf.maxbytes/1024/1024, 2) AS max_mb,
           ROUND(NVL(SUM(ss.blocks * t.block_size), 0)/1024/1024, 2) AS used_mb
    FROM dba_temp_files tf
    JOIN dba_tablespaces t ON tf.tablespace_name = t.tablespace_name
    LEFT JOIN v$tempseg_usage ss ON tf.tablespace_name = ss.tablespace
    GROUP BY tf.tablespace_name, tf.file_name, tf.bytes, tf.autoextensible,
             tf.maxbytes, t.block_size
    ORDER BY tf.tablespace_name`,

  autoextend_risk: `
    SELECT df.tablespace_name, df.file_name,
           ROUND(df.bytes/1024/1024, 2) AS current_mb,
           ROUND(df.maxbytes/1024/1024, 2) AS max_mb,
           ROUND(df.maxbytes/1024/1024 - df.bytes/1024/1024, 2) AS headroom_mb,
           ROUND((df.bytes/NULLIF(df.maxbytes,0))*100, 1) AS pct_of_max,
           df.autoextensible
    FROM dba_data_files df
    WHERE df.autoextensible = 'YES'
    ORDER BY pct_of_max DESC NULLS LAST`,

  fragmentation: `
    SELECT tablespace_name, COUNT(*) AS free_fragments,
           ROUND(SUM(bytes)/1024/1024, 2) AS total_free_mb,
           ROUND(MAX(bytes)/1024/1024, 2) AS largest_mb,
           CASE WHEN COUNT(*) > 100 THEN 'FRAGMENTED' ELSE 'OK' END AS status
    FROM dba_free_space
    GROUP BY tablespace_name
    HAVING COUNT(*) > 5
    ORDER BY free_fragments DESC`,

  undo_tablespace: `
    SELECT t.tablespace_name, t.contents, t.status,
           ROUND(SUM(df.bytes)/1024/1024, 2) AS total_mb,
           ROUND(NVL(SUM(fs.bytes), 0)/1024/1024, 2) AS free_mb
    FROM dba_tablespaces t
    JOIN dba_data_files df ON t.tablespace_name = df.tablespace_name
    LEFT JOIN dba_free_space fs ON t.tablespace_name = fs.tablespace_name
    WHERE t.contents = 'UNDO'
    GROUP BY t.tablespace_name, t.contents, t.status`,

} as const;

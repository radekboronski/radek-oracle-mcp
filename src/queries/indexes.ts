// Radek Oracle MCP — index analysis queries (Oracle 19c)

export const indexQueries = {

  all_indexes: `
    SELECT i.owner, i.index_name, i.table_owner, i.table_name,
           i.index_type, i.status, i.uniqueness, i.partitioned,
           i.visibility, i.num_rows, i.distinct_keys, i.leaf_blocks,
           i.clustering_factor, i.avg_leaf_blocks_per_key,
           TO_CHAR(i.last_analyzed, 'YYYY-MM-DD HH24:MI:SS') AS last_analyzed,
           s.bytes/1024/1024 AS size_mb
    FROM dba_indexes i
    LEFT JOIN dba_segments s ON s.owner = i.owner AND s.segment_name = i.index_name
    WHERE i.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                          'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY i.owner, i.table_name, i.index_name`,

  index_columns: `
    SELECT ic.index_owner, ic.index_name, ic.table_owner, ic.table_name,
           ic.column_name, ic.column_position, ic.descend, ic.column_length
    FROM dba_ind_columns ic
    WHERE ic.index_owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                                  'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY ic.index_owner, ic.index_name, ic.column_position`,

  index_usage: `
    SELECT u.name AS owner, u.index_name, u.table_name,
           u.monitoring, u.used,
           TO_CHAR(u.start_monitoring, 'YYYY-MM-DD HH24:MI:SS') AS monitoring_since,
           TO_CHAR(u.end_monitoring, 'YYYY-MM-DD HH24:MI:SS') AS monitoring_end
    FROM v$object_usage u
    ORDER BY u.used, u.name, u.index_name`,

  low_cardinality: `
    SELECT i.owner, i.index_name, i.table_name,
           i.distinct_keys, i.num_rows,
           ROUND(i.distinct_keys/NULLIF(i.num_rows,0)*100, 2) AS selectivity_pct,
           i.uniqueness, i.status
    FROM dba_indexes i
    WHERE i.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                          'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND i.num_rows > 10000
    AND i.distinct_keys IS NOT NULL
    AND i.uniqueness = 'NONUNIQUE'
    ORDER BY selectivity_pct NULLS LAST
    FETCH FIRST 30 ROWS ONLY`,

  invisible_indexes: `
    SELECT owner, index_name, table_name, index_type, status, uniqueness,
           num_rows, last_analyzed
    FROM dba_indexes
    WHERE visibility = 'INVISIBLE'
    AND owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                      'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, table_name`,

  unusable_indexes: `
    SELECT owner, index_name, table_name, index_type, status, uniqueness
    FROM dba_indexes
    WHERE status IN ('UNUSABLE','INVALID')
    AND owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                      'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, table_name`,

  duplicate_candidates: `
    SELECT a.owner, a.table_name, a.index_name AS index1, b.index_name AS index2,
           a.column_list AS cols1, b.column_list AS cols2
    FROM (
      SELECT ic.index_owner AS owner, ic.table_name, ic.index_name,
             LISTAGG(ic.column_name, ',') WITHIN GROUP (ORDER BY ic.column_position) AS column_list
      FROM dba_ind_columns ic
      WHERE ic.index_owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB')
      GROUP BY ic.index_owner, ic.table_name, ic.index_name
    ) a
    JOIN (
      SELECT ic.index_owner AS owner, ic.table_name, ic.index_name,
             LISTAGG(ic.column_name, ',') WITHIN GROUP (ORDER BY ic.column_position) AS column_list
      FROM dba_ind_columns ic
      WHERE ic.index_owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB')
      GROUP BY ic.index_owner, ic.table_name, ic.index_name
    ) b ON a.owner = b.owner AND a.table_name = b.table_name
    WHERE a.index_name < b.index_name
    AND (a.column_list = b.column_list
         OR b.column_list LIKE a.column_list || ',%'
         OR a.column_list LIKE b.column_list || ',%')`,

  indexes_for_table: `
    SELECT i.index_name, i.index_type, i.status, i.uniqueness,
           i.visibility, i.num_rows, i.distinct_keys, i.leaf_blocks,
           i.clustering_factor, i.last_analyzed,
           LISTAGG(ic.column_name || ' ' || ic.descend, ', ')
             WITHIN GROUP (ORDER BY ic.column_position) AS columns,
           s.bytes/1024/1024 AS size_mb
    FROM dba_indexes i
    JOIN dba_ind_columns ic ON i.owner = ic.index_owner AND i.index_name = ic.index_name
    LEFT JOIN dba_segments s ON s.owner = i.owner AND s.segment_name = i.index_name
    WHERE i.owner = :owner AND i.table_name = :table_name
    GROUP BY i.index_name, i.index_type, i.status, i.uniqueness, i.visibility,
             i.num_rows, i.distinct_keys, i.leaf_blocks, i.clustering_factor,
             i.last_analyzed, s.bytes
    ORDER BY i.index_name`,

} as const;

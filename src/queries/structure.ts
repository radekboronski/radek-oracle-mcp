// Radek Oracle MCP — schema structure queries (Oracle 19c)

export const structureQueries = {

  objects_by_type: `
    SELECT owner, object_type, COUNT(*) AS total,
           SUM(CASE WHEN status = 'INVALID' THEN 1 ELSE 0 END) AS invalid
    FROM dba_objects
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    GROUP BY owner, object_type
    ORDER BY owner, object_type`,

  invalid_objects: `
    SELECT owner, object_name, object_type, status,
           TO_CHAR(last_ddl_time, 'YYYY-MM-DD HH24:MI:SS') AS last_ddl_time
    FROM dba_objects
    WHERE status = 'INVALID'
    AND owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                      'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, object_type, object_name`,

  tables_without_pk: `
    SELECT t.owner, t.table_name, t.num_rows, t.last_analyzed
    FROM dba_tables t
    WHERE t.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                          'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND NOT EXISTS (
      SELECT 1 FROM dba_constraints c
      WHERE c.owner = t.owner AND c.table_name = t.table_name AND c.constraint_type = 'P'
    )
    ORDER BY t.owner, t.table_name`,

  fk_without_index: `
    SELECT c.owner, c.table_name, c.constraint_name,
           LISTAGG(cc.column_name, ', ') WITHIN GROUP (ORDER BY cc.position) AS fk_columns,
           rc.table_name AS referenced_table
    FROM dba_constraints c
    JOIN dba_cons_columns cc ON c.owner = cc.owner AND c.constraint_name = cc.constraint_name
    JOIN dba_constraints rc ON c.r_owner = rc.owner AND c.r_constraint_name = rc.constraint_name
    WHERE c.constraint_type = 'R'
    AND c.owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND NOT EXISTS (
      SELECT 1 FROM dba_ind_columns ic
      WHERE ic.table_owner = c.owner AND ic.table_name = c.table_name
      AND ic.column_name = cc.column_name AND ic.column_position = 1
    )
    GROUP BY c.owner, c.table_name, c.constraint_name, rc.table_name
    ORDER BY c.owner, c.table_name`,

  triggers: `
    SELECT owner, trigger_name, table_owner, table_name,
           trigger_type, triggering_event, status, action_type
    FROM dba_triggers
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, table_name, trigger_name`,

  procedures_functions: `
    SELECT owner, object_name, object_type, status,
           TO_CHAR(created, 'YYYY-MM-DD HH24:MI:SS') AS created,
           TO_CHAR(last_ddl_time, 'YYYY-MM-DD HH24:MI:SS') AS last_modified
    FROM dba_objects
    WHERE object_type IN ('PROCEDURE','FUNCTION','PACKAGE','PACKAGE BODY',
                          'TYPE','TYPE BODY')
    AND owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                      'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, object_type, object_name`,

  synonyms: `
    SELECT owner, synonym_name, table_owner, table_name, db_link
    FROM dba_synonyms
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND owner != 'PUBLIC'
    ORDER BY owner, synonym_name
    FETCH FIRST 100 ROWS ONLY`,

  constraints: `
    SELECT owner, constraint_name, constraint_type, table_name,
           status, validated, rely, last_change
    FROM dba_constraints
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND constraint_type NOT IN ('P','U')
    ORDER BY owner, table_name, constraint_type`,

  disabled_constraints: `
    SELECT owner, constraint_name, constraint_type, table_name,
           status, validated, rely
    FROM dba_constraints
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    AND status = 'DISABLED'
    ORDER BY owner, table_name`,

  sequences: `
    SELECT sequence_owner, sequence_name, min_value, max_value,
           increment_by, cycle_flag, order_flag, cache_size,
           last_number
    FROM dba_sequences
    WHERE sequence_owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                                  'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY sequence_owner, sequence_name`,

  dblinks: `
    SELECT owner, db_link, username, host, created
    FROM dba_db_links
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB')
    ORDER BY owner, db_link`,

  views: `
    SELECT owner, view_name, read_only, comments
    FROM dba_views
    WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP','APPQOSSYS','XDB',
                        'WMSYS','EXFSYS','MDSYS','OLAPSYS','ORDSYS','CTXSYS')
    ORDER BY owner, view_name
    FETCH FIRST 100 ROWS ONLY`,

  table_columns: `
    SELECT column_name, data_type, data_length, data_precision, data_scale,
           nullable, data_default, column_id, char_used,
           virtual_column, hidden_column
    FROM dba_tab_columns
    WHERE owner = :owner AND table_name = :table_name
    ORDER BY column_id`,

  table_constraints_detail: `
    SELECT c.constraint_name, c.constraint_type,
           LISTAGG(cc.column_name, ', ') WITHIN GROUP (ORDER BY cc.position) AS columns,
           c.status, c.validated, c.rely,
           rc.table_name AS ref_table, rc.constraint_name AS ref_constraint
    FROM dba_constraints c
    JOIN dba_cons_columns cc ON c.owner = cc.owner AND c.constraint_name = cc.constraint_name
    LEFT JOIN dba_constraints rc ON c.r_owner = rc.owner AND c.r_constraint_name = rc.constraint_name
    WHERE c.owner = :owner AND c.table_name = :table_name
    GROUP BY c.constraint_name, c.constraint_type, c.status, c.validated, c.rely,
             rc.table_name, rc.constraint_name
    ORDER BY c.constraint_type, c.constraint_name`,

} as const;

// Radek Oracle MCP — configuration analysis queries (Oracle 19c)

export const configurationQueries = {

  key_parameters: `
    SELECT name, value, description, isdefault, ismodified, isadjusted
    FROM v$parameter
    WHERE name IN (
      'sga_target','sga_max_size','pga_aggregate_target','pga_aggregate_limit',
      'memory_target','memory_max_target',
      'db_cache_size','shared_pool_size','large_pool_size','java_pool_size',
      'streams_pool_size','log_buffer',
      'processes','sessions','open_cursors',
      'cursor_sharing','db_block_size','db_file_multiblock_read_count',
      'parallel_max_servers','parallel_min_servers',
      'optimizer_mode','optimizer_features_enable',
      'undo_management','undo_tablespace','undo_retention',
      'enable_ddl_logging','audit_trail','audit_sys_operations',
      'log_checkpoint_interval','log_checkpoint_timeout',
      'archive_lag_target','db_recovery_file_dest_size',
      'recyclebin','statistics_level','timed_statistics',
      'resource_limit','service_names','db_domain',
      'nls_language','nls_territory','nls_characterset'
    )
    ORDER BY name`,

  non_default: `
    SELECT name, value, description, ismodified
    FROM v$parameter
    WHERE isdefault = 'FALSE'
    AND name NOT IN ('db_name','instance_name','log_archive_dest_1',
                     'control_files','db_files')
    ORDER BY name`,

  security_params: `
    SELECT name, value, description
    FROM v$parameter
    WHERE name IN (
      'audit_trail','audit_sys_operations','enable_ddl_logging',
      'o7_dictionary_accessibility','remote_os_authent',
      'remote_os_roles','sec_case_sensitive_logon',
      'sec_max_failed_login_attempts','password_grace_time',
      'password_life_time','password_lock_time',
      'password_reuse_time','password_reuse_max',
      'sqlnet.expire_time','remote_login_passwordfile',
      'utl_file_dir','os_authent_prefix'
    )
    ORDER BY name`,

  nls_settings: `
    SELECT parameter, value FROM v$nls_parameters ORDER BY parameter`,

  all_parameters: `
    SELECT name, value, description, isdefault, ismodified, type
    FROM v$parameter ORDER BY name`,

} as const;

// Radek Oracle MCP — discovery tools

import { readFileSync } from 'fs';
import { join } from 'path';

export function get_instructions(): Record<string, unknown> {
  try {
    const content = readFileSync(join(__dirname, '../../CLAUDE.md'), 'utf-8');
    return { instructions: content };
  } catch {
    return { error: 'CLAUDE.md not found' };
  }
}

export function query_tools(): Record<string, unknown> {
  return {
    server: 'Radek Oracle MCP v1.0.0',
    oracle_versions_supported: ['12c', '18c', '19c', '21c'],
    categories: {
      'Diagnostics': {
        description: 'Automated analysis and full diagnosis',
        tools: [
          { name: 'auto_diagnose', description: 'Full automatic Oracle diagnosis — health, locks, sessions, waits, SQL, tablespaces, statistics', focus_values: ['all', 'performance', 'locks', 'sessions'], note: 'Always start here' },
          { name: 'health_check', description: 'Quick Oracle health: version, SGA, buffer cache, active sessions, top wait events, tablespace fullness' },
        ],
      },
      'Sessions': {
        description: 'Oracle sessions (v$session, v$session_longops)',
        tools: [
          { name: 'analyze_sessions', description: 'All sessions, active, long-running, long ops, by user/machine/program, sleeping, resource limits', focus_values: ['summary', 'active', 'long_running', 'by_user', 'by_machine', 'by_program', 'sleeping', 'long_ops', 'limits', 'all'] },
        ],
      },
      'Locks': {
        description: 'Oracle lock analysis (v$lock, DBA_WAITERS)',
        tools: [
          { name: 'analyze_locks', description: 'Blocking sessions with kill commands, waiting sessions, v$lock, active transactions, DDL locks', focus_values: ['all', 'blocking', 'current', 'transactions', 'ddl'] },
        ],
      },
      'SQL Performance': {
        description: 'SQL analysis from v$sql',
        tools: [
          { name: 'analyze_sql', description: 'Top SQL by elapsed/CPU/disk/buffer/executions/rows, parse analysis, cursor efficiency, running SQL', focus_values: ['top_elapsed', 'top_cpu', 'top_disk', 'top_buffer', 'top_executions', 'top_rows', 'running', 'parse', 'errors', 'full_scans', 'all'] },
          { name: 'explain_query', description: 'EXPLAIN PLAN FOR + DBMS_XPLAN.DISPLAY(ALL) for a SELECT query', required: ['query'] },
        ],
      },
      'Wait Events': {
        description: 'Oracle wait event analysis (unique to Oracle)',
        tools: [
          { name: 'analyze_waits', description: 'System wait events by class, current session waits, I/O waits, concurrency, enqueue stats, latch misses, ASH', focus_values: ['summary', 'current', 'io', 'concurrency', 'enqueue', 'latch', 'history', 'ash', 'all'] },
        ],
      },
      'Memory': {
        description: 'SGA and PGA analysis',
        tools: [
          { name: 'analyze_memory', description: 'SGA dynamic components, PGA stats, memory advisors (DB cache, shared pool, PGA), sort overflow, memory params', focus_values: ['summary', 'sga', 'pga', 'advisory', 'parameters', 'sorts', 'all'] },
        ],
      },
      'Tablespaces': {
        description: 'Tablespace and datafile analysis',
        tools: [
          { name: 'analyze_tablespaces', description: 'Tablespace usage %, datafiles, free space fragmentation, temp, autoextend risk, undo tablespace', focus_values: ['usage', 'datafiles', 'free_space', 'temp', 'autoextend', 'fragmentation', 'undo', 'all'] },
        ],
      },
      'Tables': {
        description: 'Table sizes and statistics',
        tools: [
          { name: 'analyze_tables', description: 'Segment sizes, DBA_TABLES stats, stale stats, partitioned tables, tables without stats, hot by I/O, row counts', focus_values: ['sizes', 'stats', 'stale_stats', 'partitioned', 'without_stats', 'hot', 'rows', 'all'] },
          { name: 'investigate_table', description: 'Deep dive on one table: size, stats, indexes, constraints, stale stats', required: ['table_name'] },
          { name: 'list_tables', description: 'All user tables with segment sizes sorted by size' },
        ],
      },
      'Indexes': {
        description: 'Index analysis from DBA_INDEXES',
        tools: [
          { name: 'analyze_indexes', description: 'All indexes, unused (v$object_usage), low cardinality, invisible, unusable, duplicate candidates', focus_values: ['overview', 'unused', 'low_cardinality', 'invisible', 'unusable', 'duplicates', 'columns', 'all'] },
          { name: 'indexes_for_table', description: 'All indexes for a specific table', required: ['table_name'] },
          { name: 'suggest_index', description: 'Generate CREATE INDEX statement (does NOT execute)', required: ['table_name'], optional: ['columns'] },
        ],
      },
      'Storage': {
        description: 'Segments, datafile I/O, fragmentation',
        tools: [
          { name: 'analyze_storage', description: 'Segments by schema/type, largest segments, datafile I/O (v$filestat), temp usage, extent/table fragmentation', focus_values: ['summary', 'segments', 'by_schema', 'io', 'temp', 'fragmentation', 'redo', 'all'] },
        ],
      },
      'Redo Logs': {
        description: 'Redo log analysis (Oracle-specific)',
        tools: [
          { name: 'analyze_redo', description: 'Log groups/files, switch frequency, archivelog status, archived logs, redo parameters, checkpoint status', note: 'Oracle-specific — no equivalent in other databases' },
        ],
      },
      'Undo': {
        description: 'Undo management (Oracle-specific)',
        tools: [
          { name: 'analyze_undo', description: 'Undo stats (ORA-01555 errors, no space errors), undo segments, rollback stats, long transactions', note: 'Detect ORA-01555 snapshot too old risk' },
        ],
      },
      'Optimizer Statistics': {
        description: 'Statistics for query optimizer',
        tools: [
          { name: 'analyze_statistics', description: 'Stale/missing table and index stats, pending stats, gather_stats_job status, optimizer parameters', focus_values: ['stale', 'tables', 'indexes', 'columns', 'pending', 'optimizer', 'job', 'all'] },
        ],
      },
      'Data Guard': {
        description: 'Oracle Data Guard (Oracle-specific)',
        tools: [
          { name: 'analyze_dataguard', description: 'Database role, managed standby processes, apply/transport lag, archive destinations, protection mode', note: 'Oracle Data Guard — PRIMARY/STANDBY/SNAPSHOT STANDBY' },
        ],
      },
      'Configuration': {
        description: 'Oracle initialization parameters',
        tools: [
          { name: 'analyze_configuration', description: 'Key parameters, non-default parameters, security settings, NLS settings', focus_values: ['key', 'non_default', 'security', 'nls', 'all_params', 'all'] },
        ],
      },
      'Schema': {
        description: 'Schema structure, objects, constraints',
        tools: [
          { name: 'analyze_schema', description: 'Invalid objects, tables without PK, FK without index, disabled constraints, triggers, procedures, sequences, DB links', focus_values: ['issues', 'objects', 'invalid', 'keys', 'constraints', 'triggers', 'routines', 'sequences', 'synonyms', 'dblinks', 'views', 'all'] },
          { name: 'table_structure', description: 'Columns, constraints, indexes for one table', required: ['table_name'] },
        ],
      },
      'Actions': {
        description: 'Execute SQL and manage sessions',
        tools: [
          { name: 'run_query', description: 'Execute any Oracle SQL query', required: ['sql'] },
          { name: 'kill_session', description: "Kill session: ALTER SYSTEM KILL SESSION 'sid,serial#'. Always try force=false first.", required: ['sid', 'serial'], optional: ['force'], note: "force=false = graceful; force=true = IMMEDIATE" },
        ],
      },
      'Reports': {
        description: 'Generate diagnostic reports',
        tools: [
          { name: 'generate_report', description: 'Generate PDF/HTML/DOCX from markdown. Requires: Summary, Findings, Recommendations with exact Oracle SQL commands.', required: ['format', 'title', 'content'], optional: ['output_path'] },
        ],
      },
      'Discovery': {
        description: 'Explore tools and queries',
        tools: [
          { name: 'get_instructions', description: 'Return CLAUDE.md usage instructions. Call at session start.' },
          { name: 'query_tools', description: 'List all tools with categories and parameters' },
          { name: 'query_queries', description: 'Example natural-language questions for each tool' },
        ],
      },
    },
  };
}

export function query_queries(): Record<string, unknown> {
  return {
    examples: [
      {
        category: 'Full diagnosis',
        tool: 'auto_diagnose',
        questions: [
          'Run a full Oracle database diagnosis',
          'What is wrong with my Oracle database?',
          'Check everything — health, locks, performance, sessions',
          'Give me an overview of all database issues',
          'Are there any critical Oracle problems?',
          'What should I fix first?',
          'Do a complete Oracle health and performance audit',
          'Show me all Oracle issues sorted by severity',
          'Diagnose only Oracle performance issues',
          'Diagnose only locks and blocking sessions',
          'Diagnose only session issues',
          'I have slow queries — run a performance diagnosis',
          'Application is hanging — check locks and sessions',
          'Is the Oracle database in good shape right now?',
        ],
      },
      {
        category: 'Health check',
        tool: 'health_check',
        questions: [
          'Is my Oracle database healthy?',
          'What version of Oracle is this?',
          'What is the buffer cache hit ratio?',
          'How many active sessions are there?',
          'What are the top wait events?',
          'Are any tablespaces critically full?',
          'Are there blocking locks?',
          'Are there invalid objects?',
          'Show Oracle SGA and PGA usage',
          'What is the database uptime?',
          'What is the Oracle database role — primary or standby?',
          'Is archivelog mode enabled?',
        ],
      },
      {
        category: 'Sessions',
        tool: 'analyze_sessions',
        questions: [
          'Show all active Oracle sessions',
          'Which sessions have been running for a long time?',
          'Which user has the most connections?',
          'Which machine has the most sessions?',
          'Show long-running operations (v$session_longops)',
          'Are there sleeping sessions I should close?',
          'Show resource limit utilization',
          'How close are we to the PROCESSES or SESSIONS limit?',
          'Show sessions for user SCOTT',
          'Which program is creating the most sessions?',
          'Show currently active SQL by session',
        ],
      },
      {
        category: 'Locks',
        tool: 'analyze_locks',
        questions: [
          'Are there any blocking Oracle sessions?',
          'Who is blocking whom in Oracle?',
          'Show Oracle lock waits',
          'What session should I kill to resolve the lock?',
          'Show active Oracle transactions',
          'Are there DDL locks?',
          'Which session holds the most undo?',
          'Show me the blocking chain',
          'Are there row-level locks on the orders table?',
          'Kill the blocking session',
        ],
      },
      {
        category: 'SQL Performance',
        tool: 'analyze_sql',
        questions: [
          'Which SQL is consuming the most CPU in Oracle?',
          'What are the top SQL statements by elapsed time?',
          'Which queries have the most disk reads?',
          'Which SQL has the most buffer gets?',
          'What are the most frequently executed SQL statements?',
          'Which SQL runs most often?',
          'Show me running SQL queries right now',
          'Is the hard parse ratio too high?',
          'Are cursors being shared effectively?',
          'Which SQL is doing full table scans?',
          'Show me SQL with the most errors or invalidations',
          'Analyze library cache efficiency',
        ],
      },
      {
        category: 'Execution plan',
        tool: 'explain_query',
        questions: [
          'Explain this Oracle query: SELECT * FROM orders WHERE customer_id = 123',
          'Show the execution plan for a SELECT',
          'Why is this Oracle query slow?',
          'Is this query using an index?',
          'Does this query do a full table scan?',
          'What is the cost of this execution plan?',
          'Show DBMS_XPLAN output for this SELECT',
        ],
      },
      {
        category: 'Wait Events',
        tool: 'analyze_waits',
        questions: [
          'What are the top Oracle wait events?',
          'Where is Oracle spending the most time waiting?',
          'Are there I/O wait problems?',
          'Are there concurrency waits?',
          'Show current session wait events',
          'What enqueue (lock) types are waiting?',
          'Are there latch contention issues?',
          'Show wait event history per session',
          'Show Active Session History (ASH) for the last 10 minutes',
          'Is log file sync causing waits?',
          'What is the db file sequential read wait time?',
        ],
      },
      {
        category: 'Memory',
        tool: 'analyze_memory',
        questions: [
          'How is Oracle SGA memory allocated?',
          'What is the PGA memory usage?',
          'Is the buffer cache large enough?',
          'Is the shared pool large enough?',
          'Are there sort spills to disk?',
          'What does the DB cache advisor recommend?',
          'What does the PGA advisor recommend?',
          'Show Oracle memory parameters',
          'Is MEMORY_TARGET or SGA_TARGET configured?',
        ],
      },
      {
        category: 'Tablespaces',
        tool: 'analyze_tablespaces',
        questions: [
          'Which tablespaces are nearly full?',
          'Show Oracle tablespace usage',
          'How much free space is in each tablespace?',
          'Are any datafiles at their max size?',
          'Show autoextend risk for datafiles',
          'How is the temp tablespace configured?',
          'Is the undo tablespace large enough?',
          'Show tablespace free space fragmentation',
          'Which tablespace should I add a datafile to?',
        ],
      },
      {
        category: 'Table analysis',
        tool: 'analyze_tables',
        questions: [
          'Which Oracle tables are the largest?',
          'Show table sizes and row counts',
          'Which tables have stale statistics?',
          'Which tables have never been analyzed?',
          'Show partitioned tables',
          'Which tables get the most I/O?',
          'Show tables without statistics',
          'What are the hottest tables by I/O?',
        ],
      },
      {
        category: 'Single table deep dive',
        tool: 'investigate_table',
        questions: [
          'Tell me everything about the ORDERS table',
          'Deep dive on SCOTT.EMP',
          'Show full details for the PRODUCTS table',
          'Analyze the PAYMENTS table',
          'What is the health of the INVOICES table?',
        ],
      },
      {
        category: 'Index analysis',
        tool: 'analyze_indexes',
        questions: [
          'Are there unused Oracle indexes?',
          'Which indexes are invisible?',
          'Which indexes are unusable and need rebuilding?',
          'Are there duplicate indexes in Oracle?',
          'Which indexes have very low cardinality?',
          'Show all indexes with their statistics',
          'Which indexes should I drop?',
          'Show index column lists',
        ],
      },
      {
        category: 'Storage',
        tool: 'analyze_storage',
        questions: [
          'How much storage does each Oracle schema use?',
          'What are the largest Oracle segments?',
          'Which datafiles have the most I/O?',
          'Are there temp segment issues?',
          'Which tables have the most extents (high fragmentation)?',
          'Show empty block ratio per table',
          'Which segments are fragmented?',
        ],
      },
      {
        category: 'Redo logs',
        tool: 'analyze_redo',
        questions: [
          'How often are Oracle redo logs switching?',
          'Is the redo log size appropriate?',
          'Show Oracle redo log groups and files',
          'Is archivelog mode enabled?',
          'Are there frequent log switches in the last hour?',
          'Show archived log sizes',
          'Is checkpoint performance OK?',
          'What are the redo log parameters?',
        ],
      },
      {
        category: 'Undo management',
        tool: 'analyze_undo',
        questions: [
          'Are there ORA-01555 snapshot too old errors?',
          'Is the undo retention sufficient?',
          'How much undo space is being used?',
          'Are there undo no space errors?',
          'Show undo statistics over time',
          'Which transactions have the largest undo?',
          'What is the longest running query relative to undo?',
        ],
      },
      {
        category: 'Optimizer statistics',
        tool: 'analyze_statistics',
        questions: [
          'Which Oracle tables have stale statistics?',
          'Which tables have never been analyzed?',
          'Is GATHER_STATS_JOB running?',
          'Show optimizer statistics parameters',
          'Are there pending statistics that need publishing?',
          'Show index statistics',
          'Are there column histograms?',
        ],
      },
      {
        category: 'Data Guard',
        tool: 'analyze_dataguard',
        questions: [
          'Is this Oracle database a primary or standby?',
          'What is the Data Guard apply lag?',
          'What is the redo transport lag?',
          'Are archive log destinations healthy?',
          'Show managed standby MRP process status',
          'Is the standby synchronized?',
          'What is the protection mode?',
        ],
      },
      {
        category: 'Configuration',
        tool: 'analyze_configuration',
        questions: [
          'Show key Oracle initialization parameters',
          'What Oracle parameters have been changed from defaults?',
          'Is cursor_sharing set appropriately?',
          'What are the Oracle security settings?',
          'Is auditing enabled?',
          'Show NLS settings',
          'What is the UNDO_RETENTION setting?',
          'Show memory-related parameters',
          'Are parallel query settings optimal?',
        ],
      },
      {
        category: 'Schema structure',
        tool: 'analyze_schema',
        questions: [
          'Are there invalid Oracle objects?',
          'Which tables are missing a primary key?',
          'Are there foreign keys without indexes?',
          'Are there disabled constraints?',
          'Show all Oracle triggers',
          'Show stored procedures and packages',
          'Show database links',
          'Are there any sequences?',
          'Show all views',
          'Recompile invalid objects',
        ],
      },
      {
        category: 'Table structure',
        tool: 'table_structure',
        questions: [
          'Show the full structure of the ORDERS table',
          'What columns does EMPLOYEES have?',
          'What is the primary key of PRODUCTS?',
          'What are the foreign keys on ORDERS?',
          'Show me the data types for all columns in INVOICES',
          'What constraints are on the PAYMENTS table?',
        ],
      },
      {
        category: 'Run SQL',
        tool: 'run_query',
        questions: [
          "Run: SELECT COUNT(*) FROM orders WHERE status = 'PENDING'",
          "Execute: SELECT * FROM v\\$parameter WHERE name LIKE 'sga%'",
          'Run a custom Oracle SQL query',
          'Count rows in the EMPLOYEES table',
          "Show last 10 rows from AUDIT_LOG: SELECT * FROM audit_log WHERE rownum <= 10",
          "Run: SELECT username, count(*) FROM v\\$session GROUP BY username",
        ],
      },
      {
        category: 'Kill sessions',
        tool: 'kill_session',
        note: 'Always use force=false first (graceful); use force=true (IMMEDIATE) only if graceful does not work.',
        questions: [
          'Kill Oracle session SID=100, SERIAL#=12345',
          'Stop the blocking session',
          'Kill the long-running session gracefully',
          'Immediately kill session 234,5678',
          'Disconnect idle session SID=55',
        ],
      },
      {
        category: 'Reports',
        tool: 'generate_report',
        note: 'Collect data with diagnostic tools first, then pass as markdown to generate_report. Never pass output_path — content is returned inline.',
        questions: [
          'Generate an Oracle health report as PDF',
          'Create an HTML diagnostic report for Oracle',
          'Generate a PDF with the diagnosis results',
          'Create a report named diagnosis_2026-02-25.pdf',
          'Save the full analysis as an HTML file',
          'Generate a Word document Oracle report',
          'Create a DOCX report using the Assessment template',
          'Export the Oracle analysis as a branded .docx file',
        ],
      },
    ],
  };
}

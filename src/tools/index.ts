import { health_check } from './health';
import { auto_diagnose } from './auto_diagnose';
import { analyze_sessions } from './sessions';
import { analyze_locks } from './locks';
import { analyze_sql, explain_query } from './performance';
import { analyze_waits } from './waits';
import { analyze_memory } from './memory';
import { analyze_tablespaces } from './tablespaces';
import { analyze_tables, investigate_table, list_tables } from './tables';
import { analyze_indexes, indexes_for_table, suggest_index } from './indexes';
import { analyze_storage } from './storage';
import { analyze_redo } from './redo';
import { analyze_undo } from './undo';
import { analyze_statistics } from './statistics';
import { analyze_dataguard } from './dataguard';
import { analyze_configuration } from './configuration';
import { analyze_schema, table_structure } from './structure';
import { run_query, kill_session } from './actions';
import { generate_report, extractConnInfo } from './report';
import { query_tools, query_queries, get_instructions } from './meta';
import type { ToolDef, ToolListEntry } from '../types';

// ─── Tool registry ──────────────────────────────────────────────────────────

const TOOLS: Record<string, ToolDef> = {

  // DIAGNOSTICS
  auto_diagnose: {
    fn: (db, a) => auto_diagnose(db, a.focus_area as string | undefined),
    description: '🤖 AUTOMATIC FULL DIAGNOSIS — USE FIRST. Runs health, locks, sessions, waits, SQL performance, tablespaces, statistics. Returns prioritised findings and ready-to-run Oracle commands.',
    schema: {
      type: 'object',
      properties: {
        focus_area: {
          type: 'string',
          enum: ['all', 'performance', 'locks', 'sessions'],
          default: 'all',
          description: 'Narrow diagnosis to one area (default: all)',
        },
      },
    },
  },
  health_check: {
    fn: (db) => health_check(db),
    description: '📊 Quick Oracle health: version, SGA/PGA, buffer cache hit ratio, active sessions, top wait events, tablespace fullness, blocking locks, invalid objects.',
    schema: { type: 'object', properties: {} },
  },

  // SESSIONS
  analyze_sessions: {
    fn: (db, a) => analyze_sessions(db, a.focus as string | undefined),
    description: '👥 Session analysis: all sessions, active, long-running, long operations (v$session_longops), by user/machine/program, sleeping, resource limits.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'summary', 'active', 'long_running', 'by_user', 'by_machine', 'by_program', 'sleeping', 'long_ops', 'limits'], default: 'summary' },
      },
    },
  },

  // LOCKS
  analyze_locks: {
    fn: (db, a) => analyze_locks(db, a.focus as string | undefined),
    description: '🔒 Oracle lock analysis: blocking sessions with kill commands, waiting sessions, all v$lock entries, active transactions with undo usage, DDL locks.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'blocking', 'current', 'transactions', 'ddl'], default: 'all' },
      },
    },
  },

  // PERFORMANCE / SQL
  analyze_sql: {
    fn: (db, a) => analyze_sql(db, a.focus as string | undefined),
    description: '⚡ SQL performance from v$sql: top by elapsed time, CPU, disk reads, buffer gets, executions, rows processed. Parse analysis, cursor efficiency, shared pool, running SQL.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'top_elapsed', 'top_cpu', 'top_disk', 'top_buffer', 'top_executions', 'top_rows', 'running', 'parse', 'errors', 'full_scans'], default: 'top_elapsed' },
      },
    },
  },
  explain_query: {
    fn: (db, a) => explain_query(db, a.query as string),
    description: '📖 EXPLAIN PLAN FOR a SELECT/WITH query. Uses DBMS_XPLAN.DISPLAY with ALL format. Returns full execution plan with cost, cardinality, access paths.',
    schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'SELECT or WITH query to explain' } },
      required: ['query'],
    },
  },

  // WAIT EVENTS (Oracle-specific)
  analyze_waits: {
    fn: (db, a) => analyze_waits(db, a.focus as string | undefined),
    description: '⏱️ Oracle wait event analysis (v$system_event, v$session_wait, ASH): system wait events by class, current session waits, I/O waits, concurrency waits, enqueue statistics, latch misses.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'summary', 'current', 'io', 'concurrency', 'enqueue', 'latch', 'history', 'ash'], default: 'summary' },
      },
    },
  },

  // MEMORY
  analyze_memory: {
    fn: (db, a) => analyze_memory(db, a.focus as string | undefined),
    description: '🧠 SGA/PGA memory analysis: SGA components, dynamic SGA, PGA stats, memory advisors (DB cache, shared pool, PGA), sort overflow, memory parameters.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'summary', 'sga', 'pga', 'advisory', 'parameters', 'sorts'], default: 'summary' },
      },
    },
  },

  // TABLESPACES
  analyze_tablespaces: {
    fn: (db, a) => analyze_tablespaces(db, a.focus as string | undefined),
    description: '📂 Tablespace analysis: usage %, datafiles with autoextend, free space fragments, temp tablespace, autoextend risk, fragmentation, undo tablespace.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'usage', 'datafiles', 'free_space', 'temp', 'autoextend', 'fragmentation', 'undo'], default: 'usage' },
      },
    },
  },

  // TABLES
  analyze_tables: {
    fn: (db, a) => analyze_tables(db, a.focus as string | undefined),
    description: '📋 Table analysis: segment sizes, DBA_TABLES statistics, stale stats, partitioned tables, tables without statistics, hot tables by I/O, row counts.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'sizes', 'stats', 'stale_stats', 'partitioned', 'without_stats', 'hot', 'rows'], default: 'sizes' },
      },
    },
  },
  investigate_table: {
    fn: (db, a) => investigate_table(db, a.table_name as string),
    description: '🔬 Deep dive on ONE table: segment size, DBA_TAB_STATISTICS, indexes, constraints, stale stats, extent fragmentation. Format: OWNER.TABLE_NAME or TABLE_NAME.',
    schema: {
      type: 'object',
      properties: { table_name: { type: 'string', description: 'Table name (OWNER.TABLE_NAME or TABLE_NAME)' } },
      required: ['table_name'],
    },
  },
  list_tables: {
    fn: (db) => list_tables(db),
    description: '📋 List all user tables with segment sizes, sorted by size descending.',
    schema: { type: 'object', properties: {} },
  },

  // INDEXES
  analyze_indexes: {
    fn: (db, a) => analyze_indexes(db, a.focus as string | undefined),
    description: '🔑 Index analysis: all indexes with stats, unused (v$object_usage), low cardinality, invisible indexes, unusable indexes, duplicate/redundant candidates.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'overview', 'unused', 'low_cardinality', 'invisible', 'unusable', 'duplicates', 'columns'], default: 'overview' },
      },
    },
  },
  indexes_for_table: {
    fn: (db, a) => indexes_for_table(db, a.table_name as string),
    description: '🔑 All indexes for a specific table with column lists, status, cardinality, clustering factor. Format: OWNER.TABLE_NAME.',
    schema: {
      type: 'object',
      properties: { table_name: { type: 'string' } },
      required: ['table_name'],
    },
  },
  suggest_index: {
    fn: (db, a) => suggest_index(db, a.table_name as string, a.columns as string[] | undefined),
    description: '💡 Generate CREATE INDEX statement for given table and columns. Does NOT execute it.',
    schema: {
      type: 'object',
      properties: {
        table_name: { type: 'string' },
        columns: { type: 'array', items: { type: 'string' }, description: 'Columns to include in the index' },
      },
      required: ['table_name'],
    },
  },

  // STORAGE
  analyze_storage: {
    fn: (db, a) => analyze_storage(db, a.focus as string | undefined),
    description: '💾 Storage analysis: segments by schema/type, largest segments, datafile I/O (v$filestat), temp segment usage, extent fragmentation, table fragmentation.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'summary', 'segments', 'by_schema', 'io', 'temp', 'fragmentation', 'redo'], default: 'summary' },
      },
    },
  },

  // REDO (Oracle-specific)
  analyze_redo: {
    fn: (db) => analyze_redo(db),
    description: '📝 Redo log analysis: log groups/files, switch frequency per hour, archivelog status, archived logs, redo parameters, checkpoint status. Oracle-specific.',
    schema: { type: 'object', properties: {} },
  },

  // UNDO (Oracle-specific)
  analyze_undo: {
    fn: (db) => analyze_undo(db),
    description: '↩️ Undo analysis: v$undostat (ORA-01555 snapshot too old errors, no space errors), undo segments, rollback stats, long-running transactions. Oracle-specific.',
    schema: { type: 'object', properties: {} },
  },

  // STATISTICS
  analyze_statistics: {
    fn: (db, a) => analyze_statistics(db, a.focus as string | undefined),
    description: '📈 Optimizer statistics: stale/missing table stats, index stats, column stats, pending stats, GATHER_STATS_JOB status, optimizer parameters.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'stale', 'tables', 'indexes', 'columns', 'pending', 'optimizer', 'job'], default: 'stale' },
      },
    },
  },

  // DATA GUARD (Oracle-specific)
  analyze_dataguard: {
    fn: (db) => analyze_dataguard(db),
    description: '🛡️ Data Guard status: database role (PRIMARY/STANDBY), managed standby processes, apply/transport lag (v$dataguard_stats), archive destinations, protection mode. Oracle-specific.',
    schema: { type: 'object', properties: {} },
  },

  // CONFIGURATION
  analyze_configuration: {
    fn: (db, a) => analyze_configuration(db, a.focus as string | undefined),
    description: '⚙️ Oracle configuration analysis: key v$parameter values, non-default parameters, security settings (audit, auth), NLS settings, all parameters.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'key', 'non_default', 'security', 'nls', 'all_params'], default: 'key' },
      },
    },
  },

  // SCHEMA STRUCTURE
  analyze_schema: {
    fn: (db, a) => analyze_schema(db, a.focus as string | undefined),
    description: '🏗️ Schema analysis: invalid objects (compile recommendations), tables without PK, FK without index, disabled constraints, triggers, procedures/functions, sequences, DB links, views.',
    schema: {
      type: 'object',
      properties: {
        focus: { type: 'string', enum: ['all', 'issues', 'objects', 'invalid', 'keys', 'constraints', 'triggers', 'routines', 'sequences', 'synonyms', 'dblinks', 'views'], default: 'issues' },
      },
    },
  },
  table_structure: {
    fn: (db, a) => table_structure(db, a.table_name as string),
    description: '📐 Full structure of one table: columns (types, nullable, defaults), constraints (PK, UK, FK, CHECK), indexes with columns. Format: OWNER.TABLE_NAME.',
    schema: {
      type: 'object',
      properties: { table_name: { type: 'string' } },
      required: ['table_name'],
    },
  },

  // ACTIONS
  run_query: {
    fn: (db, a) => run_query(db, a.sql as string),
    description: '▶️ Execute any SQL query against Oracle. Returns rows as objects and row count.',
    schema: {
      type: 'object',
      properties: { sql: { type: 'string', description: 'SQL to execute' } },
      required: ['sql'],
    },
  },
  kill_session: {
    fn: (db, a) => kill_session(db, a.sid as number, a.serial as number, a.force as boolean | undefined),
    description: "☠️ Kill an Oracle session with ALTER SYSTEM KILL SESSION 'sid,serial#'. force=false = graceful, force=true = IMMEDIATE.",
    schema: {
      type: 'object',
      properties: {
        sid:    { type: 'integer', description: 'SID from v$session (analyze_sessions)' },
        serial: { type: 'integer', description: 'SERIAL# from v$session' },
        force:  { type: 'boolean', default: false, description: 'true = IMMEDIATE (instant kill), false = graceful' },
      },
      required: ['sid', 'serial'],
    },
  },

  // REPORTS
  generate_report: {
    fn: (db, a) => { const { database, server } = db ? extractConnInfo(db) : {}; return generate_report(a.format as string, a.title as string, a.content as string, a.output_path as string | undefined, database, server); },
    description: '📄 Generate a PDF, HTML, or DOCX report from markdown content. Always include: 1) Summary, 2) Findings with data tables, 3) Recommendations with exact runnable Oracle SQL. "docx" uses Assessment.docx branded template. Does NOT query the database.',
    schema: {
      type: 'object',
      properties: {
        format:      { type: 'string', enum: ['pdf', 'html', 'docx'], description: 'Output format' },
        title:       { type: 'string', description: 'Report title' },
        content:     { type: 'string', description: 'Report body in markdown' },
        output_path: { type: 'string', description: 'Absolute path to save the file (optional)' },
      },
      required: ['format', 'title', 'content'],
    },
  },

  // META / DISCOVERY
  get_instructions: {
    fn: () => Promise.resolve(get_instructions()),
    description: '📖 Return the latest CLAUDE.md usage instructions for this Oracle MCP server. Call once at session start to get up-to-date guidelines.',
    schema: { type: 'object', properties: {} },
  },
  query_tools: {
    fn: () => Promise.resolve(query_tools()),
    description: '🔍 List all available tools with categories, descriptions, parameters, and notes. No database access needed.',
    schema: { type: 'object', properties: {} },
  },
  query_queries: {
    fn: () => Promise.resolve(query_queries()),
    description: '💬 Show example natural language questions for each tool category. No database access needed.',
    schema: { type: 'object', properties: {} },
  },
};

// Tools that don't require a database connection
export const NO_DB_TOOLS = new Set(['generate_report', 'query_tools', 'query_queries', 'get_instructions']);

// MCP tools/list format
export const TOOL_LIST: ToolListEntry[] = Object.entries(TOOLS).map(([name, t]) => ({
  name,
  description: t.description,
  inputSchema: t.schema,
}));

// Dispatch a tool call
export async function callTool(name: string, dbUrl: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.fn(dbUrl, args);
}

# Architecture — Radek Oracle MCP

Internal architecture of the Oracle 19c diagnostic MCP server.

---

## Overview

```
AI Client (Claude Code, Cursor)
        │
        │  HTTPS + Bearer JWT + X-Database-URL header
        ▼
Cloudflare Tunnel  ──────────────────────────────────────┐
radek-oracle-mcp.clickchain.eu                           │
(tunnel: ffcf0846-8f91-4687-a312-989ac2e11835)           │
                                                  localhost:8003
                                                          │
                                                 ┌────────▼───────┐
                                                 │   server.ts    │
                                                 │  HTTP server   │
                                                 │  (Node.js)     │
                                                 └────────┬───────┘
                                                          │ JWT verify
                                                          │ JSON-RPC parse
                                                 ┌────────▼───────┐
                                                 │ mcp-handler.ts │
                                                 │  MCP Protocol  │
                                                 │  JSON-RPC 2.0  │
                                                 └────────┬───────┘
                                                          │ tool dispatch
                                                 ┌────────▼───────┐
                                                 │ tools/index.ts │
                                                 │  Tool Registry │
                                                 │  (29 tools)    │
                                                 └────────┬───────┘
                    ┌────────────────────────────┼────────────────────────┐
                    │                            │                        │
           ┌────────▼───────┐          ┌─────────▼──────┐       ┌────────▼───────┐
           │  tools/*.ts    │          │  tools/db.ts   │       │ tools/report.ts│
           │  Business      │─────────▶│  oracledb Pool │       │ PDF/HTML/DOCX  │
           │  Logic         │          │  + version     │       │ (Puppeteer     │
           └────────┬───────┘          │    cache       │       │  + adm-zip)    │
                    │                  └─────────┬──────┘       └────────────────┘
           ┌────────▼───────┐          ┌─────────▼──────┐
           │ queries/*.ts   │          │  Oracle DB     │
           │  Oracle SQL    │─────────▶│  12c/18c/19c/  │
           └────────────────┘          │  21c           │
                                       └────────────────┘
```

---

## Layers

### Layer 1 — HTTP Server (`src/server.ts`)

Node.js built-in `http` module. No external framework (no Express, no Fastify).

Supported endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status — no token required |
| `POST` | `/mcp` | Main MCP endpoint — requires Bearer JWT |
| `DELETE` | `/mcp` | End MCP session (returns 200) |
| `OPTIONS` | `*` | CORS preflight |
| `GET` | `/.well-known/oauth-protected-resource` | OAuth autodiscovery |
| `GET` | `/.well-known/oauth-authorization-server` | Returns 404 — static JWT only |

CORS: all origins allowed (`*`), methods GET/POST/DELETE/OPTIONS.

Database URL is read from the `X-Database-URL` request header on every call — never hardcoded or stored server-side.

### Layer 2 — MCP Protocol (`src/mcp-handler.ts`)

Implements [Model Context Protocol](https://modelcontextprotocol.io/) v2025-11-25 over JSON-RPC 2.0.

| MCP Method | Description |
|------------|-------------|
| `initialize` | Handshake — returns capabilities and serverInfo: `Radek Oracle MCP v1.0.0` |
| `notifications/initialized` | Initialization confirmation |
| `tools/list` | List all 29 tools |
| `tools/call` | Invoke a tool with arguments |

### Layer 3 — Tool Registry (`src/tools/index.ts`)

Central registry of all 29 Oracle tools. Four tools do not require a database connection (`NO_DB_TOOLS`):
- `generate_report`, `query_tools`, `query_queries`, `get_instructions`

### Layer 4 — Tool Logic (`src/tools/*.ts`)

| File | Tools |
|------|-------|
| `auto_diagnose.ts` | `auto_diagnose` — orchestrator |
| `health.ts` | `health_check` |
| `sessions.ts` | `analyze_sessions` |
| `locks.ts` | `analyze_locks` |
| `performance.ts` | `analyze_sql`, `explain_query` |
| `waits.ts` | `analyze_waits` |
| `memory.ts` | `analyze_memory` |
| `tablespaces.ts` | `analyze_tablespaces` |
| `tables.ts` | `analyze_tables`, `investigate_table`, `list_tables` |
| `indexes.ts` | `analyze_indexes`, `indexes_for_table`, `suggest_index` |
| `storage.ts` | `analyze_storage` |
| `redo.ts` | `analyze_redo` |
| `undo.ts` | `analyze_undo` |
| `statistics.ts` | `analyze_statistics` |
| `dataguard.ts` | `analyze_dataguard` |
| `configuration.ts` | `analyze_configuration` |
| `structure.ts` | `analyze_schema`, `table_structure` |
| `actions.ts` | `run_query`, `kill_session` |
| `report.ts` | `generate_report` (PDF/HTML/DOCX) |
| `docx.ts` | DOCX generation using Assessment.docx template (internal) |
| `meta.ts` | `query_tools`, `query_queries`, `get_instructions` |
| `db.ts` | Oracle connection pool + version detection (internal) |

### Layer 5 — SQL Queries (`src/queries/*.ts`)

| File | Oracle Views Used |
|------|-------------------|
| `health.ts` | `v$database`, `v$instance`, `v$sga`, `v$pgastat`, `v$session`, `v$sysstat`, `v$system_event`, `dba_tablespaces`, `dba_data_files`, `dba_free_space` |
| `locks.ts` | `v$lock`, `v$session`, `v$sql`, `v$transaction`, `dba_objects`, `dba_ddl_locks` |
| `sessions.ts` | `v$session`, `v$session_wait`, `v$sql`, `v$session_longops`, `v$resource_limit` |
| `performance.ts` | `v$sql`, `v$sysstat`, `v$librarycache`, `v$session` |
| `waits.ts` | `v$system_event`, `v$session_wait`, `v$session`, `v$enqueue_statistics`, `v$latch`, `v$session_event`, `v$active_session_history` |
| `memory.ts` | `v$sga_dynamic_components`, `v$sgastat`, `v$pgastat`, `v$sql_workarea_histogram`, `v$db_cache_advice`, `v$shared_pool_advice`, `v$pga_target_advice`, `v$parameter`, `v$buffer_pool_statistics` |
| `tablespaces.ts` | `dba_tablespaces`, `dba_data_files`, `dba_free_space`, `dba_temp_files`, `v$tempseg_usage` |
| `tables.ts` | `dba_segments`, `dba_tables`, `dba_tab_statistics`, `dba_part_tables`, `dba_tab_partitions`, `v$segment_statistics` |
| `indexes.ts` | `dba_indexes`, `dba_ind_columns`, `v$object_usage`, `dba_segments` |
| `storage.ts` | `dba_segments`, `v$filestat`, `v$datafile`, `v$tempseg_usage`, `v$log`, `v$archive_dest` |
| `redo.ts` | `v$log`, `v$logfile`, `v$log_history`, `v$archived_log`, `v$parameter`, `v$datafile_header`, `v$database`, `v$instance` |
| `undo.ts` | `v$undostat`, `v$parameter`, `dba_segments`, `v$rollname`, `v$rollstat`, `v$transaction`, `v$session`, `v$sql` |
| `statistics.ts` | `dba_tab_statistics`, `dba_ind_statistics`, `dba_tab_col_statistics`, `dba_tab_pending_stats`, `dba_scheduler_jobs`, `v$parameter` |
| `dataguard.ts` | `v$managed_standby`, `v$dataguard_stats`, `v$archive_dest`, `v$archive_dest_status`, `v$database`, `gv$archive_dest_status` |
| `configuration.ts` | `v$parameter`, `v$nls_parameters` |
| `structure.ts` | `dba_objects`, `dba_tables`, `dba_constraints`, `dba_cons_columns`, `dba_triggers`, `dba_synonyms`, `dba_sequences`, `dba_db_links`, `dba_views`, `dba_tab_columns` |

### Layer 6 — Oracle Connection Pool + Version Cache (`src/tools/db.ts`)

One pool per unique `dbUrl`. Two caches:

| Cache | Key | Value |
|-------|-----|-------|
| `pools` | `dbUrl` | `oracledb.Pool` |
| `versionCache` | `dbUrl` | `{ major, minor, patch, full }` |

Pool parameters:

| Parameter | Value |
|-----------|-------|
| `poolMax` | 5 |
| `poolMin` | 1 |
| `poolTimeout` | 60 seconds |
| `stmtCacheSize` | 30 statements |
| `MAX_ROWS` | 300 rows (safety cap) |

Oracle URL parsing:
```
oracle://user:password@host:1521/service_name
oracle+ssl://user:password@host:2484/service_name
```

Parsed to `oracledb.createPool({ user, password, connectString: "host:1521/service" })`.

Version detection flow:
1. `getOracleVersion(dbUrl)` → check `versionCache`
2. Cache miss → `SELECT instance_name, version, version_full FROM v$instance`
3. Parse `"19.3.0.0.0"` → `{ major: 19, minor: 3, patch: 0, full: "19.3.0.0.0" }`
4. Cache hit on all subsequent calls — zero overhead

---

## Oracle Version Support

Oracle version differences are minimal compared to MySQL 5.6/5.7/8.0 differences:

| Feature | Oracle 12c | Oracle 18c | Oracle 19c | Oracle 21c |
|---------|-----------|-----------|-----------|-----------|
| `FETCH FIRST N ROWS ONLY` | ✓ (12c+) | ✓ | ✓ | ✓ |
| `v$active_session_history` | ✓ (Diagnostics Pack) | ✓ | ✓ | ✓ |
| CDB/PDB (Multitenant) | ✓ (12c+) | ✓ | ✓ | ✓ |
| `version_full` in v$instance | — | — | ✓ (19c+) | ✓ |
| `DBMS_XPLAN.DISPLAY ALL` | ✓ | ✓ | ✓ | ✓ |
| AWR (requires license) | ✓ | ✓ | ✓ | ✓ |

`explain_query` automatically falls back to `version_full` → `version` if running on pre-19c Oracle.

---

## Dependencies

### Runtime

| Package | Usage |
|---------|-------|
| `oracledb` v6 | Oracle Database client (thin mode — no Oracle Client needed) |
| `jsonwebtoken` | JWT sign/verify |
| `puppeteer-core` | PDF generation via headless Chrome |
| `adm-zip` | DOCX generation — unpack/repack Assessment.docx template |

### Dev

| Package | Usage |
|---------|-------|
| `typescript` | TypeScript compiler |
| `ts-node` | Run TS in development without building |
| `@types/node` | Node.js type declarations |
| `@types/jsonwebtoken` | JWT type declarations |
| `@types/adm-zip` | adm-zip type declarations |

---

## File Structure

```
radek-oracle-mcp/
├── src/
│   ├── server.ts              # HTTP server, JWT auth, routing (port 8003)
│   ├── mcp-handler.ts         # MCP protocol (JSON-RPC 2.0)
│   ├── config.ts              # Load db.config.json
│   ├── types.ts               # TypeScript definitions
│   ├── banner.ts              # ASCII art banner (RADEK ORACLE)
│   ├── create-token.ts        # CLI for generating JWT tokens
│   ├── types/
│   │   └── oracledb.d.ts      # TypeScript type stub for oracledb
│   ├── tools/
│   │   ├── index.ts           # Tool registry (29 tools), dispatch
│   │   ├── db.ts              # oracledb pool + version detection
│   │   ├── auto_diagnose.ts   # Automatic diagnosis orchestrator
│   │   ├── health.ts          # health_check
│   │   ├── sessions.ts        # analyze_sessions
│   │   ├── locks.ts           # analyze_locks
│   │   ├── performance.ts     # analyze_sql, explain_query
│   │   ├── waits.ts           # analyze_waits
│   │   ├── memory.ts          # analyze_memory
│   │   ├── tablespaces.ts     # analyze_tablespaces
│   │   ├── tables.ts          # analyze_tables, investigate_table, list_tables
│   │   ├── indexes.ts         # analyze_indexes, indexes_for_table, suggest_index
│   │   ├── storage.ts         # analyze_storage
│   │   ├── redo.ts            # analyze_redo
│   │   ├── undo.ts            # analyze_undo
│   │   ├── statistics.ts      # analyze_statistics
│   │   ├── dataguard.ts       # analyze_dataguard
│   │   ├── configuration.ts   # analyze_configuration
│   │   ├── structure.ts       # analyze_schema, table_structure
│   │   ├── actions.ts         # run_query, kill_session
│   │   ├── report.ts          # generate_report (PDF/HTML/DOCX)
│   │   ├── docx.ts            # DOCX template processor
│   │   └── meta.ts            # query_tools, query_queries, get_instructions
│   └── queries/
│       ├── health.ts          # Oracle SQL for health check
│       ├── locks.ts           # Oracle SQL for locks
│       ├── sessions.ts        # Oracle SQL for sessions
│       ├── performance.ts     # Oracle SQL for v$sql analysis
│       ├── waits.ts           # Oracle SQL for wait events
│       ├── memory.ts          # Oracle SQL for SGA/PGA
│       ├── tablespaces.ts     # Oracle SQL for tablespaces
│       ├── tables.ts          # Oracle SQL for table analysis
│       ├── indexes.ts         # Oracle SQL for index analysis
│       ├── storage.ts         # Oracle SQL for segments/storage
│       ├── redo.ts            # Oracle SQL for redo logs
│       ├── undo.ts            # Oracle SQL for undo
│       ├── statistics.ts      # Oracle SQL for optimizer stats
│       ├── dataguard.ts       # Oracle SQL for Data Guard
│       ├── configuration.ts   # Oracle SQL for v$parameter
│       └── structure.ts       # Oracle SQL for schema analysis
├── dist/                      # Compiled JavaScript (generated by tsc)
├── Assessment.docx            # DOCX report template (logo + branded styles)
├── db.config.json             # Runtime configuration (gitignored)
├── db.config.example.json     # Configuration template
├── package.json
├── tsconfig.json
├── README.md
├── ARCHITECTURE.md
├── CLAUDE.md
├── TOOLS.md
├── QUERIES.md
├── TREE.md
└── USER_GUIDE.md
```

---

## Cloudflare Tunnel Configuration

```
Server:      radek-oracle-mcp
DNS:         radek-oracle-mcp.clickchain.eu
Tunnel ID:   ffcf0846-8f91-4687-a312-989ac2e11835
Port:        8003
Config file: ~/.cloudflared/config-radek-oracle-mcp.yml
Credentials: ~/.cloudflared/ffcf0846-8f91-4687-a312-989ac2e11835.json
```

Config file content:
```yaml
credentials-file: /home/mcp/.cloudflared/ffcf0846-8f91-4687-a312-989ac2e11835.json
ingress:
  - hostname: radek-oracle-mcp.clickchain.eu
    service: http://127.0.0.1:8003
  - service: http_status:404
```

---

## Security

- No external HTTP framework — reduced attack surface
- JWT HS256 tokens with configurable expiry — rotation via changing `auth.secret`
- Oracle connection pool max 5 connections — protection against connection exhaustion
- MAX_ROWS = 300 — prevents oversized MCP responses
- `kill_session` validates `sid` and `serial` as positive integers before building `ALTER SYSTEM KILL SESSION` — no SQL injection
- SSL support: `oracle+ssl://` URL scheme — uses oracledb SSL options
- No `multipleStatements` concern (Oracle does not allow this in thin mode)

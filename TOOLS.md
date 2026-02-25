# Tools Reference — Radek Oracle MCP

Complete documentation for all 29 Oracle 19c diagnostic tools.

---

## Starting Point

### `auto_diagnose`

**Always start here.** Runs in sequence: health check, blocking locks, session analysis, wait events (top 5), SQL performance (top elapsed), tablespace fullness, stale optimizer statistics. Returns sorted findings with ready-to-run Oracle commands.

```
focus_area: "all" | "performance" | "locks" | "sessions"
default: "all"
```

Output includes:
- `oracle_version` — detected Oracle version (e.g. `"19.3.0.0.0"`)
- `health_level` — `OK` / `WARNING` / `CRITICAL`
- `issues[]` — critical problems requiring immediate action
- `warnings[]` — low-risk issues
- `recommendations[]` — list of ready-to-run Oracle SQL commands

Thresholds:
- Buffer cache hit ratio < 85% → `CRITICAL`
- Buffer cache hit ratio < 95% → `WARNING`
- Any blocking lock → `CRITICAL`
- Tablespace > 95% full → `CRITICAL`
- Tablespace > 85% full → `WARNING`
- Invalid objects present → `WARNING`

---

## Diagnostics

### `health_check`

Quick Oracle database health overview. No parameters required.

Returns:
- Oracle version (from `v$instance`)
- Database name, role (PRIMARY/STANDBY), open mode, log mode
- SGA and PGA sizes (MB)
- Buffer cache hit ratio — healthy ≥ 95%
- Library cache hit ratio
- Active / inactive session counts
- Top 10 wait events (excluding Idle)
- Tablespace fullness summary
- Blocking lock count
- Invalid object count
- Redo log group status

---

## Sessions

### `analyze_sessions`

Oracle session analysis from `v$session`, `v$session_wait`, `v$sql`, `v$session_longops`.

```
focus: "all" | "summary" | "active" | "long_running" | "by_user" | "by_machine" | "by_program" | "sleeping" | "long_ops" | "limits"
default: "summary"
```

| focus | Returns |
|-------|---------|
| `summary` | All sessions + by_user + resource limits |
| `active` | Sessions with STATUS='ACTIVE', with current SQL and wait event |
| `long_running` | Active sessions with `last_call_et > 30s` |
| `by_user` | Session counts per Oracle username |
| `by_machine` | Session counts per client machine |
| `by_program` | Session counts per program name |
| `sleeping` | Inactive sessions (STATUS='INACTIVE') sorted by idle time |
| `long_ops` | Long-running operations from `v$session_longops` with % complete |
| `limits` | Resource utilization vs limits from `v$resource_limit` |

---

## Locks

### `analyze_locks`

Oracle lock analysis using `v$lock`, `v$session`, `dba_objects`, `v$transaction`.

```
focus: "all" | "blocking" | "current" | "transactions" | "ddl"
default: "all"
```

| focus | Returns |
|-------|---------|
| `blocking` | Sessions blocking others — includes `ALTER SYSTEM KILL SESSION` command |
| `current` | All entries in `v$lock` with lock mode and request mode decoded |
| `transactions` | Active transactions from `v$transaction` with undo usage in KB |
| `ddl` | DDL locks from `dba_ddl_locks` |

Kill command format (from recommendations):
```sql
ALTER SYSTEM KILL SESSION 'sid,serial#' IMMEDIATE;
```

**Always try without `IMMEDIATE` first** (graceful). Use `IMMEDIATE` if session does not respond.

---

## SQL Performance

### `analyze_sql`

SQL performance analysis from `v$sql` and `v$sysstat`.

```
focus: "all" | "top_elapsed" | "top_cpu" | "top_disk" | "top_buffer" | "top_executions" | "top_rows" | "running" | "parse" | "errors" | "full_scans"
default: "top_elapsed"
```

| focus | Data source | Returns |
|-------|-------------|---------|
| `top_elapsed` | `v$sql` | Top 25 SQL by total elapsed time |
| `top_cpu` | `v$sql` | Top 25 SQL by CPU time |
| `top_disk` | `v$sql` | Top 25 SQL by physical disk reads |
| `top_buffer` | `v$sql` | Top 25 SQL by logical buffer gets |
| `top_executions` | `v$sql` | Top 25 SQL by execution count |
| `top_rows` | `v$sql` | Top 25 SQL by rows processed |
| `running` | `v$session` + `v$sql` | Currently executing SQL |
| `parse` | `v$sysstat`, `v$librarycache` | Hard parse ratio, cursor efficiency, shared pool stats |
| `errors` | `v$sql` | SQL with high reload/invalidation counts |
| `full_scans` | `v$sql` | SQL containing full table scan patterns |

Each row includes: `sql_id`, `executions`, `elapsed_secs`, `avg_elapsed_ms`, `cpu_secs`, `buffer_gets`, `disk_reads`, `sql_text` (first 300 chars), `module`.

### `explain_query`

Runs `EXPLAIN PLAN FOR` + `DBMS_XPLAN.DISPLAY(NULL, NULL, 'ALL')` for a SELECT/WITH query.

```
query: string — SELECT or WITH only (required)
```

Returns the full execution plan text including:
- Operation type (TABLE ACCESS FULL, INDEX RANGE SCAN, HASH JOIN, etc.)
- Object name
- Cost, Cardinality, Bytes estimates
- Partition pruning info
- Predicate information

**Note:** Requires `CREATE ANY TABLE` privilege on the Oracle user (for `plan_table`).

---

## Wait Events

### `analyze_waits`

Oracle wait event analysis — unique to Oracle, no equivalent in MySQL or PostgreSQL.

```
focus: "all" | "summary" | "current" | "io" | "concurrency" | "enqueue" | "latch" | "history" | "ash"
default: "summary"
```

| focus | Data source | Returns |
|-------|-------------|---------|
| `summary` | `v$system_event` | System wait events by total time (non-Idle) |
| `current` | `v$session_wait` + `v$session` | Current waits per session |
| `io` | `v$system_event` | User I/O and System I/O class events |
| `concurrency` | `v$system_event` | Concurrency, Application, Cluster class events |
| `enqueue` | `v$enqueue_statistics` | Enqueue (lock) wait types with cumulative wait times |
| `latch` | `v$latch` | Latch misses and miss percentage |
| `history` | `v$session_event` | Per-session wait event history |
| `ash` | `v$active_session_history` | Active Session History — last 10 minutes (10g+) |

Wait classes:
- `User I/O` — disk reads, sequential and scattered reads
- `System I/O` — redo log writes, control file I/O
- `Concurrency` — buffer busy waits, row cache lock
- `Application` — lock waits (enqueues), client waits
- `Cluster` — Oracle RAC inter-node communication
- `Network` — SQL*Net messages

---

## Memory

### `analyze_memory`

SGA and PGA memory analysis with Oracle advisory views.

```
focus: "all" | "summary" | "sga" | "pga" | "advisory" | "parameters" | "sorts"
default: "summary"
```

| focus | Data source | Returns |
|-------|-------------|---------|
| `summary` | `v$sga_dynamic_components`, `v$pgastat`, `v$parameter` | SGA components, PGA stats, memory params |
| `sga` | `v$sga_dynamic_components`, `v$sgastat`, `v$buffer_pool_statistics` | SGA component breakdown, buffer pool |
| `pga` | `v$pgastat`, `v$sql_workarea_histogram`, `v$pga_target_advice` | PGA stats, histogram, advisory |
| `advisory` | `v$db_cache_advice`, `v$shared_pool_advice`, `v$pga_target_advice` | Oracle memory advisors |
| `parameters` | `v$parameter` | SGA_TARGET, PGA_AGGREGATE_TARGET, MEMORY_TARGET, etc. |
| `sorts` | `v$sysstat` | Disk sort count, memory sort count, disk sort percentage |

Key metrics:
- Buffer cache hit ratio (target: ≥ 95%)
- Sort disk spills — high count → increase `PGA_AGGREGATE_TARGET`
- Advisory views show optimal sizes for buffer cache and shared pool

---

## Tablespaces

### `analyze_tablespaces`

Tablespace and datafile analysis.

```
focus: "all" | "usage" | "datafiles" | "free_space" | "temp" | "autoextend" | "fragmentation" | "undo"
default: "usage"
```

| focus | Returns |
|-------|---------|
| `usage` | Tablespace usage % — CRITICAL ≥ 95%, WARNING ≥ 80% |
| `datafiles` | Datafiles with size, autoextend on/off, max size, increment |
| `free_space` | Free space fragments per tablespace — high count = fragmentation |
| `temp` | Temp tablespace files and current usage |
| `autoextend` | Files near their `MAXSIZE` limit — high risk of "ORA-01658: unable to extend" |
| `fragmentation` | Tablespaces with many free fragments (> 5) |
| `undo` | Undo tablespace size and free space |

Add datafile command:
```sql
ALTER TABLESPACE USERS ADD DATAFILE SIZE 2G AUTOEXTEND ON NEXT 512M MAXSIZE UNLIMITED;
```

---

## Tables

### `analyze_tables`

Table sizes and statistics from `dba_segments`, `dba_tables`, `dba_tab_statistics`.

```
focus: "all" | "sizes" | "stats" | "stale_stats" | "partitioned" | "without_stats" | "hot" | "rows"
default: "sizes"
```

| focus | Returns |
|-------|---------|
| `sizes` | Segment sizes in MB from `dba_segments` — top 50 |
| `stats` | Row counts, block counts, avg row length, last analyzed, compression, partitioned flag |
| `stale_stats` | Tables with `stale_stats = 'YES'` or not analyzed in > 7 days |
| `partitioned` | Partitioned tables with partitioning type, subpartition type, partition count |
| `without_stats` | Tables with `last_analyzed IS NULL` |
| `hot` | Tables with highest I/O counts from `v$segment_statistics` |
| `rows` | Tables sorted by `num_rows` descending |

### `investigate_table`

In-depth analysis of a single Oracle table.

```
table_name: string — format: OWNER.TABLE_NAME or TABLE_NAME (required)
```

Returns:
- Segment size (MB, blocks, extents)
- Optimizer statistics (num_rows, last_analyzed, stale_stats flag)
- All indexes (name, type, status, columns, cardinality)
- All constraints (PK, UK, FK, CHECK)
- Recommendations (gather stats if stale, MOVE if high extent count)

### `list_tables`

All user tables with segment sizes, sorted by size descending. No parameters required.

---

## Indexes

### `analyze_indexes`

Index analysis from `dba_indexes`, `dba_ind_columns`, `v$object_usage`.

```
focus: "all" | "overview" | "unused" | "low_cardinality" | "invisible" | "unusable" | "duplicates" | "columns"
default: "overview"
```

| focus | Returns |
|-------|---------|
| `overview` | All indexes: type, status, uniqueness, visibility, num_rows, distinct_keys, leaf_blocks, size MB |
| `unused` | Indexes from `v$object_usage` with `used = 'NO'` (requires monitoring to be enabled) |
| `low_cardinality` | Indexes with selectivity < threshold — consider dropping |
| `invisible` | Indexes with `visibility = 'INVISIBLE'` — not used by optimizer |
| `unusable` | Indexes with `status IN ('UNUSABLE','INVALID')` — need REBUILD |
| `duplicates` | Index pairs where one column list is a prefix of another |
| `columns` | All index columns with position and sort order |

**Enable index monitoring:**
```sql
ALTER INDEX OWNER.INDEX_NAME MONITORING USAGE;
-- After workload runs:
SELECT * FROM v$object_usage;
ALTER INDEX OWNER.INDEX_NAME NOMONITORING USAGE;
```

**Rebuild unusable index:**
```sql
ALTER INDEX OWNER.INDEX_NAME REBUILD;
-- For partitioned:
ALTER INDEX OWNER.INDEX_NAME REBUILD PARTITION partition_name;
```

### `indexes_for_table`

All indexes for a specific table.

```
table_name: string — OWNER.TABLE_NAME (required)
```

Returns: index name, type, status, uniqueness, visibility, columns (with position and sort order), cardinality, clustering factor, size MB.

### `suggest_index`

Generates a `CREATE INDEX` statement — **does not execute it**.

```
table_name: string (required)
columns: string[] (optional)
```

---

## Storage

### `analyze_storage`

Segment and storage analysis.

```
focus: "all" | "summary" | "segments" | "by_schema" | "io" | "temp" | "fragmentation" | "redo"
default: "summary"
```

| focus | Data source | Returns |
|-------|-------------|---------|
| `summary` | `dba_segments` | Segment sizes by schema and type |
| `segments` | `dba_segments` | Top 50 largest individual segments |
| `by_schema` | `dba_segments` | Total storage grouped by owner and segment type |
| `io` | `v$filestat` + `v$datafile` | Per-datafile physical reads/writes and average I/O times |
| `temp` | `v$tempseg_usage` | Active temp segment allocations by session |
| `fragmentation` | `dba_segments` | Segments with high extent count (> 100) |
| `redo` | `v$log` | Total redo log size |

---

## Redo Logs

### `analyze_redo`

Oracle redo log analysis. No parameters required. Oracle-specific — no equivalent in other databases.

Returns:
- Log groups (sequence#, size MB, members, status, archived flag)
- Log files (member paths, type)
- Log switch frequency per hour (last 24h) — frequent switches (> 4/hr) → increase log size
- Log switch count per day (last 7 days)
- Archivelog status (LOG_MODE from `v$database`, ARCHIVER from `v$instance`)
- Recent archived logs (last 24h with sizes)
- Redo-related parameters
- Checkpoint status per datafile

**Fix frequent log switches:**
```sql
-- Add a new larger log group
ALTER DATABASE ADD LOGFILE GROUP 4 '/oradata/redo04.log' SIZE 1G;
-- Drop an old small group (must be INACTIVE, not CURRENT)
ALTER DATABASE DROP LOGFILE GROUP 1;
```

---

## Undo

### `analyze_undo`

Oracle undo management analysis. Oracle-specific — no equivalent in other databases.

Returns from `v$undostat` (10-minute intervals, last 20):
- `undoblks` — undo blocks used
- `txncount` — transaction count per interval
- `maxquerylen` — longest running query in interval (seconds)
- `ssolderrcnt` — ORA-01555 "snapshot too old" errors
- `nospaceerrcnt` — undo space errors
- `activeblks`, `unexpiredblks`, `expiredblks`

Also returns undo parameters, undo segments, rollback stats.

**Fix ORA-01555:**
```sql
-- Increase undo retention (in seconds)
ALTER SYSTEM SET UNDO_RETENTION = 1800 SCOPE=BOTH;

-- Guarantee undo retention (prevents reuse before expiry)
ALTER TABLESPACE UNDOTBS1 RETENTION GUARANTEE;
```

---

## Optimizer Statistics

### `analyze_statistics`

Oracle optimizer statistics management.

```
focus: "all" | "stale" | "tables" | "indexes" | "columns" | "pending" | "optimizer" | "job"
default: "stale"
```

| focus | Returns |
|-------|---------|
| `stale` | Tables with `stale_stats = 'YES'` or not analyzed in > 7 days |
| `tables` | All table statistics — sample size, last analyzed, stale flag |
| `indexes` | Index statistics — distinct keys, leaf blocks, clustering factor |
| `columns` | Column statistics — cardinality, nulls, histogram type |
| `pending` | Pending statistics in `dba_tab_pending_stats` (not yet published) |
| `optimizer` | Optimizer-related parameters: `optimizer_mode`, `statistics_level`, `cursor_sharing` |
| `job` | GATHER_STATS_JOB and AUTO_SPACE_ADVISOR_JOB status |

**Gather statistics:**
```sql
-- Single table
EXEC DBMS_STATS.GATHER_TABLE_STATS('OWNER', 'TABLE_NAME', CASCADE => TRUE);

-- Entire schema
EXEC DBMS_STATS.GATHER_SCHEMA_STATS('OWNER', CASCADE => TRUE);

-- Full database (DBA only)
EXEC DBMS_STATS.GATHER_DATABASE_STATS(CASCADE => TRUE);

-- Publish pending statistics
EXEC DBMS_STATS.PUBLISH_PENDING_STATS('OWNER', 'TABLE_NAME');
```

---

## Data Guard

### `analyze_dataguard`

Oracle Data Guard status. No parameters required. Oracle-specific.

Returns:
- `database_role` — PRIMARY / PHYSICAL STANDBY / LOGICAL STANDBY / SNAPSHOT STANDBY
- `protection_mode` — MAXIMUM AVAILABILITY / MAXIMUM PERFORMANCE / MAXIMUM PROTECTION
- `switchover_status` — NOT ALLOWED / TO PRIMARY / TO STANDBY / SESSIONS ACTIVE
- Managed standby processes from `v$managed_standby` (MRP0, RFS, etc.)
- Apply lag and transport lag from `v$dataguard_stats`
- Archive destination status from `v$archive_dest_status`
- `synchronized` flag per destination

**Key metrics:**
- `apply lag` — how far behind is the standby (target: 0)
- `transport lag` — redo not yet sent to standby
- `MRP0 status = APPLYING_LOG` — standby is healthy and applying

---

## Configuration

### `analyze_configuration`

Oracle initialization parameter analysis.

```
focus: "all" | "key" | "non_default" | "security" | "nls" | "all_params"
default: "key"
```

| focus | Returns |
|-------|---------|
| `key` | Most important parameters: SGA/PGA sizes, processes, sessions, cursor_sharing, optimizer_mode, undo, audit, etc. |
| `non_default` | Parameters changed from their Oracle defaults (`isdefault = 'FALSE'`) |
| `security` | Security-sensitive parameters: audit_trail, remote_os_authent, password policies, etc. |
| `nls` | NLS settings from `v$nls_parameters` |
| `all_params` | All parameters from `v$parameter` |

Common recommendations generated:
- `cursor_sharing = 'EXACT'` → consider `FORCE` to reduce hard parses
- `statistics_level = 'BASIC'` → set to `TYPICAL` to enable advisors
- `audit_trail = 'NONE'` → consider enabling
- `recyclebin = 'on'` → purge with `PURGE DBA_RECYCLEBIN;`

---

## Schema

### `analyze_schema`

Schema object analysis — quality issues and structure review.

```
focus: "all" | "issues" | "objects" | "invalid" | "keys" | "constraints" | "triggers" | "routines" | "sequences" | "synonyms" | "dblinks" | "views"
default: "issues"
```

| focus | Returns |
|-------|---------|
| `issues` | Invalid objects + tables without PK + FK without index + disabled constraints |
| `objects` | All objects grouped by type with invalid count |
| `invalid` | Invalid objects — with `ALTER ... COMPILE` recommendation |
| `keys` | Tables without PK, FK without supporting index |
| `constraints` | All non-PK/UK constraints (FK, CHECK) with status and validation |
| `triggers` | All triggers with type, event, status |
| `routines` | Procedures, functions, packages, types with status |
| `sequences` | Sequences with min/max/increment/last_number |
| `synonyms` | Public and private synonyms |
| `dblinks` | Database links with target host |
| `views` | Views list |

**Recompile invalid objects:**
```sql
-- Schema-level (skips already-valid objects)
EXEC DBMS_UTILITY.COMPILE_SCHEMA('OWNER', COMPILE_ALL => FALSE);

-- Single object
ALTER PROCEDURE owner.proc_name COMPILE;
ALTER PACKAGE owner.pkg_name COMPILE;
ALTER PACKAGE BODY owner.pkg_name COMPILE BODY;
```

### `table_structure`

Full structure of a single Oracle table.

```
table_name: string — OWNER.TABLE_NAME (required)
```

Returns:
- Columns: name, data type, length/precision/scale, nullable, default, virtual flag
- Constraints: PK, UK, FK (with referenced table), CHECK — with status
- Indexes: name, type, uniqueness, visibility, columns, size MB
- Optimizer statistics: num_rows, last_analyzed, stale_stats

---

## Actions

### `run_query`

Executes any Oracle SQL and returns results.

```
sql: string (required)
```

Limit: maximum 300 rows (excess truncated with warning). All result rows are plain objects with column names as keys.

### `kill_session`

Stops an Oracle session using `ALTER SYSTEM KILL SESSION`.

```
sid: integer (required)
serial: integer (required)
force: boolean (default: false)
```

| force | Oracle command | Behavior |
|-------|----------------|----------|
| `false` | `ALTER SYSTEM KILL SESSION 'sid,serial#'` | Graceful — marks session for termination |
| `true` | `ALTER SYSTEM KILL SESSION 'sid,serial#' IMMEDIATE` | Immediate termination |

**Always try `force: false` first.** Use `force: true` only if the session does not terminate.

`sid` and `serial#` come from `analyze_sessions`, `analyze_locks`, or:
```sql
SELECT sid, serial#, username, status FROM v$session WHERE type = 'USER';
```

---

## Reports

### `generate_report`

Generates a PDF, HTML, or DOCX report from markdown content.

```
format: "pdf" | "html" | "docx" (required)
title: string (required)
content: string — markdown (required)
output_path: string — absolute path (optional, do not pass for remote MCP)
```

| format | Requirements | Notes |
|--------|-------------|-------|
| `pdf` | Chrome/Chromium on the server | Rendered via Puppeteer |
| `html` | None | No external dependencies |
| `docx` | None | Uses `Assessment.docx` branded template (logo, header, footer) |

**Important:**
- Does NOT query Oracle — collect data with other tools first
- Without `output_path` → returns content inline: `html`, `pdf_base64`, `docx_base64`
- Save the base64 content locally: `echo "<base64>" | base64 -d > report.pdf`

**Mandatory report sections:**
1. **Summary** — database state and diagnosis scope (3–5 bullet points)
2. **Findings** — categorized issues (CRITICAL, WARNING, INFO) with data tables
3. **Recommendations** — exact runnable Oracle SQL for every finding

File naming: `oracle_diagnosis_YYYY-MM-DD.pdf`, `oracle_assessment_YYYY-MM-DD.docx`

---

## Discovery

### `query_tools`

Returns a catalog of all 29 Oracle tools with categories, descriptions, focus values, and notes. No database connection required.

### `query_queries`

Returns categories of natural language questions with mapped tools and parameters. No database connection required.

### `get_instructions`

Returns the full content of `CLAUDE.md` — the AI assistant usage instructions for this server. Call once at the start of a session to get the latest guidelines.

---

## Tools That Do Not Require a Database

| Tool | Description |
|------|-------------|
| `generate_report` | Generates report locally from provided markdown |
| `query_tools` | Tool catalog (static, no Oracle access needed) |
| `query_queries` | Query catalog (static, no Oracle access needed) |
| `get_instructions` | Returns CLAUDE.md content (file read only) |

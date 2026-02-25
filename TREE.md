# Decision Tree — Radek Oracle MCP

Use this guide to choose the right Oracle diagnostic tool based on symptom or goal.

---

## Starting Point — always `auto_diagnose`

```
Always start with:
  auto_diagnose
    ├── health_level: OK       → database is healthy, drill into specifics if needed
    ├── health_level: WARNING  → low-risk issue present, investigate
    └── health_level: CRITICAL → immediate action required
```

`auto_diagnose` runs: `health_check`, `analyze_locks(blocking)`, `analyze_sessions(summary)`, `analyze_waits(summary)`, `analyze_sql(top_elapsed)`, `analyze_tablespaces(usage)`, `analyze_statistics(stale)`. Returns `recommendations[]` with ready-to-run Oracle SQL.

---

## Branch 1 — Application is slow / SQL runs too long

```
auto_diagnose(focus_area: "performance")
  │
  ├── which SQL consumes the most time?
  │     analyze_sql(focus: "top_elapsed")     ← top 25 by total elapsed time
  │     analyze_sql(focus: "top_cpu")         ← top 25 by CPU time
  │     analyze_sql(focus: "top_disk")        ← top 25 by physical disk reads
  │     analyze_sql(focus: "top_buffer")      ← top 25 by logical buffer gets
  │
  ├── which SQL runs most often?
  │     analyze_sql(focus: "top_executions")  ← high-frequency SQL
  │     analyze_sql(focus: "top_rows")        ← most rows returned
  │
  ├── hard parse ratio too high?
  │     analyze_sql(focus: "parse")
  │       └── hard_parse_pct > 10% →
  │             ALTER SYSTEM SET CURSOR_SHARING = 'FORCE' SCOPE=BOTH;
  │             or increase SHARED_POOL_SIZE
  │
  ├── currently running SQL?
  │     analyze_sql(focus: "running")
  │       └── long-running → kill_session(sid, serial, force: false)
  │
  ├── where is Oracle waiting?
  │     analyze_waits(focus: "summary")       ← top wait events
  │     analyze_waits(focus: "current")       ← current waits per session
  │     analyze_waits(focus: "io")            ← I/O specific waits
  │
  └── explain a specific query?
        explain_query("SELECT ...")
          └── full table scan on large table?
                analyze_indexes(focus: "overview")
                  └── suggest_index(table_name, columns)
                        └── review → execute manually
```

---

## Branch 2 — Blocking sessions / application is hanging

```
auto_diagnose(focus_area: "locks")
  │
  ├── who is blocking whom?
  │     analyze_locks(focus: "blocking")
  │       └── kill blocker:
  │             kill_session(blocking_sid, blocking_serial, force: false)
  │               └── still blocking? → kill_session(..., force: true)
  │
  ├── active transactions holding resources?
  │     analyze_locks(focus: "transactions")
  │       └── large undo usage → check application logic
  │
  ├── DDL lock conflicts?
  │     analyze_locks(focus: "ddl")
  │       └── kill session holding DDL lock
  │
  ├── all current locks in v$lock?
  │     analyze_locks(focus: "current")
  │
  └── sleeping sessions holding locks?
        analyze_sessions(focus: "sleeping")
          └── kill_session(sid, serial, force: false)
```

---

## Branch 3 — Too many sessions / ORA-12519 / process limit

```
auto_diagnose(focus_area: "sessions")
  │
  ├── how close are we to PROCESSES/SESSIONS limit?
  │     analyze_sessions(focus: "limits")
  │       └── > 85% usage →
  │             ALTER SYSTEM SET PROCESSES = 500 SCOPE=SPFILE;  -- requires restart
  │
  ├── which users have the most sessions?
  │     analyze_sessions(focus: "by_user")
  │
  ├── which machines are connecting the most?
  │     analyze_sessions(focus: "by_machine")
  │
  ├── which programs hold the most sessions?
  │     analyze_sessions(focus: "by_program")
  │
  ├── long-running sessions (possible runaway queries)?
  │     analyze_sessions(focus: "long_running")
  │       └── kill_session(sid, serial, force: false)
  │
  ├── long operations in progress?
  │     analyze_sessions(focus: "long_ops")    ← v$session_longops with % complete
  │
  └── idle sessions wasting connections?
        analyze_sessions(focus: "sleeping")
          └── kill_session(sid, serial, force: false)
```

---

## Branch 4 — Tablespace is full / ORA-01653 / ORA-01658

```
analyze_tablespaces(focus: "usage")
  │
  ├── which tablespace is > 90% full?
  │     → CRITICAL threshold
  │       ALTER TABLESPACE <name> ADD DATAFILE SIZE 2G AUTOEXTEND ON NEXT 512M MAXSIZE UNLIMITED;
  │
  ├── which datafiles are near their MAXSIZE?
  │     analyze_tablespaces(focus: "autoextend")
  │       └── file near max → add new datafile to tablespace
  │
  ├── temp tablespace usage?
  │     analyze_tablespaces(focus: "temp")
  │       └── full → add tempfile or kill large sort sessions
  │
  ├── undo tablespace full?
  │     analyze_tablespaces(focus: "undo")
  │       └── ALTER TABLESPACE UNDOTBS1 ADD DATAFILE SIZE 2G AUTOEXTEND ON NEXT 256M MAXSIZE UNLIMITED;
  │
  ├── space fragmentation in tablespace?
  │     analyze_tablespaces(focus: "fragmentation")
  │       └── many fragments → ALTER TABLESPACE <name> COALESCE;
  │
  └── what segments take the most space?
        analyze_storage(focus: "segments")
          └── investigate_table(owner.table_name)
```

---

## Branch 5 — Memory issues / SGA or PGA problems

```
analyze_memory(focus: "summary")
  │
  ├── buffer cache hit ratio < 95%?
  │     analyze_memory(focus: "sga")
  │       └── increase buffer cache:
  │             ALTER SYSTEM SET DB_CACHE_SIZE = 4G SCOPE=BOTH;
  │             or
  │             ALTER SYSTEM SET SGA_TARGET = 8G SCOPE=BOTH;
  │
  ├── sorts spilling to disk?
  │     analyze_memory(focus: "sorts")
  │       └── disk sort % > 5% →
  │             ALTER SYSTEM SET PGA_AGGREGATE_TARGET = 2G SCOPE=BOTH;
  │
  ├── shared pool too small (ORA-04031)?
  │     analyze_memory(focus: "sga")
  │       └── increase: ALTER SYSTEM SET SHARED_POOL_SIZE = 1G SCOPE=BOTH;
  │
  ├── memory advisor recommendations?
  │     analyze_memory(focus: "advisory")
  │       └── check DB_CACHE_ADVICE, SHARED_POOL_ADVICE, PGA_TARGET_ADVICE
  │
  └── what are the memory parameters?
        analyze_memory(focus: "parameters")
```

---

## Branch 6 — Redo log issues / log switches too frequent

```
analyze_redo
  │
  ├── switches > 4/hour?
  │     → log files too small
  │       ALTER DATABASE ADD LOGFILE GROUP 4 '/oradata/redo04.log' SIZE 1G;
  │       (then drop old small groups when INACTIVE)
  │
  ├── ARCHIVER = 'STOPPED'?
  │     → archive log destination full or unreachable
  │       ALTER SYSTEM ARCHIVE LOG ALL;
  │       or check alert log for archiving errors
  │
  ├── log group STATUS = 'INACTIVE' with ARCHIVED = 'NO'?
  │     → unarchived redo
  │       ALTER SYSTEM ARCHIVE LOG ALL;
  │
  ├── checkpoint taking too long?
  │     → check checkpoint parameters:
  │       analyze_configuration(focus: "key")
  │       review: log_checkpoint_interval, log_checkpoint_timeout
  │
  └── how much redo is being generated?
        → see switch_frequency query (MB/hour)
```

---

## Branch 7 — Undo issues / ORA-01555 snapshot too old

```
analyze_undo
  │
  ├── ssolderrcnt > 0?
  │     → ORA-01555 snapshot too old errors
  │       ALTER SYSTEM SET UNDO_RETENTION = 1800 SCOPE=BOTH;
  │       ALTER TABLESPACE UNDOTBS1 RETENTION GUARANTEE;
  │
  ├── nospaceerrcnt > 0?
  │     → undo tablespace full
  │       analyze_tablespaces(focus: "undo")
  │         └── add datafile to undo tablespace
  │
  ├── long_running_queries?
  │     → long query preventing undo purge
  │       analyze_sessions(focus: "long_running")
  │         └── consider killing or waiting for it to complete
  │
  └── undo segment configuration?
        → check undo_management, undo_tablespace, undo_retention
```

---

## Branch 8 — Optimizer statistics are stale / bad execution plans

```
analyze_statistics(focus: "stale")
  │
  ├── tables with stale stats?
  │     → EXEC DBMS_STATS.GATHER_TABLE_STATS('OWNER', 'TABLE_NAME', CASCADE => TRUE);
  │
  ├── gather all schema stats?
  │     → EXEC DBMS_STATS.GATHER_SCHEMA_STATS('OWNER', CASCADE => TRUE);
  │
  ├── GATHER_STATS_JOB not running?
  │     analyze_statistics(focus: "job")
  │       └── check if scheduler job is enabled and running
  │
  ├── are stats pending (not published)?
  │     analyze_statistics(focus: "pending")
  │       └── EXEC DBMS_STATS.PUBLISH_PENDING_STATS('OWNER', 'TABLE_NAME');
  │
  ├── optimizer parameters correct?
  │     analyze_statistics(focus: "optimizer")
  │       └── review: optimizer_mode, statistics_level, cursor_sharing
  │
  └── index statistics stale?
        analyze_statistics(focus: "indexes")
          └── EXEC DBMS_STATS.GATHER_INDEX_STATS('OWNER', 'INDEX_NAME');
```

---

## Branch 9 — Schema review / code audit

```
list_tables                                ← all tables with sizes
  │
  ├── structural issues?
  │     analyze_schema(focus: "issues")         ← invalid objects + missing PKs + FK without index + disabled constraints
  │     analyze_schema(focus: "invalid")        ← compile recommendations
  │     analyze_schema(focus: "keys")           ← PK/FK review
  │     analyze_schema(focus: "constraints")    ← all constraints + status
  │     analyze_schema(focus: "triggers")       ← all triggers
  │     analyze_schema(focus: "routines")       ← procedures, functions, packages
  │     analyze_schema(focus: "sequences")      ← sequences
  │     analyze_schema(focus: "dblinks")        ← database links
  │
  └── specific table?
        table_structure(OWNER.TABLE_NAME)
          └── indexes_for_table(OWNER.TABLE_NAME)
```

---

## Branch 10 — Index review

```
analyze_indexes(focus: "overview")
  │
  ├── unusable indexes?
  │     analyze_indexes(focus: "unusable")
  │       └── ALTER INDEX OWNER.INDEX_NAME REBUILD;
  │
  ├── invisible indexes?
  │     analyze_indexes(focus: "invisible")
  │       └── ALTER INDEX OWNER.INDEX_NAME VISIBLE;
  │             or DROP INDEX OWNER.INDEX_NAME;
  │
  ├── low cardinality (poor selectivity)?
  │     analyze_indexes(focus: "low_cardinality")
  │       └── evaluate: DROP INDEX OWNER.INDEX_NAME;
  │
  ├── duplicate or redundant?
  │     analyze_indexes(focus: "duplicates")
  │       └── DROP INDEX OWNER.REDUNDANT_INDEX;
  │
  ├── indexes never used (monitoring)?
  │     analyze_indexes(focus: "unused")
  │       └── requires MONITORING USAGE to be enabled first
  │
  └── all indexes for a specific table?
        indexes_for_table(OWNER.TABLE_NAME)
```

---

## Branch 11 — Data Guard health

```
analyze_dataguard
  │
  ├── database_role = 'PHYSICAL STANDBY'?
  │     → check apply lag from v$dataguard_stats
  │       apply lag > 0 → check MRP0 process status
  │
  ├── apply lag > acceptable threshold?
  │     → check redo transport: analyze_redo on primary
  │       check network between primary and standby
  │
  ├── archive destination ERROR?
  │     → check network and standby accessibility
  │       ALTER SYSTEM SET LOG_ARCHIVE_DEST_STATE_2 = 'DEFER'; -- temporary bypass
  │
  └── protection mode?
        MAXIMUM AVAILABILITY → synchronous transport + guaranteed
        MAXIMUM PERFORMANCE  → asynchronous transport
        MAXIMUM PROTECTION   → synchronous, primary shuts down if standby unavailable
```

---

## Branch 12 — Reports / export results

```
Collect data with tools → then call generate_report without output_path:

generate_report(
  format: "pdf",
  title: "Oracle Diagnosis — 2026-02-25",
  content: "<markdown with findings and recommendations>"
)

Formats:
  format: "pdf"   → PDF via Puppeteer (Chrome/Chromium on server)
  format: "html"  → HTML file (no dependencies)
  format: "docx"  → Word document using Assessment.docx branded template
                    (includes company logo and predefined heading/body styles)

Save returned base64 locally:
  # PDF
  echo "<pdf_base64>" | base64 -d > oracle_diagnosis_2026-02-25.pdf

  # DOCX
  echo "<docx_base64>" | base64 -d > oracle_assessment_2026-02-25.docx

Mandatory report structure:
  1. Summary       — database state + diagnosis scope (3-5 bullet points)
  2. Findings      — categorised issues (CRITICAL / WARNING / INFO) with data tables
  3. Recommendations — exact runnable Oracle SQL for every finding
```

---

## Quick Reference — symptom → tool

| Symptom | Tool |
|---------|------|
| Application generally slow | `auto_diagnose` |
| Top SQL by elapsed time | `analyze_sql(top_elapsed)` |
| Top SQL by CPU | `analyze_sql(top_cpu)` |
| Excessive disk reads | `analyze_sql(top_disk)` |
| High logical I/O | `analyze_sql(top_buffer)` |
| Too many hard parses | `analyze_sql(parse)` |
| Running SQL right now | `analyze_sql(running)` |
| Explain a specific query | `explain_query` |
| Sessions blocking others | `analyze_locks(blocking)` |
| All locks in v$lock | `analyze_locks(current)` |
| Large undo transactions | `analyze_locks(transactions)` |
| DDL lock conflicts | `analyze_locks(ddl)` |
| Too many sessions | `analyze_sessions(limits)` |
| Sessions by user/machine | `analyze_sessions(by_user)` |
| Long-running sessions | `analyze_sessions(long_running)` |
| Long operations progress | `analyze_sessions(long_ops)` |
| Top wait events | `analyze_waits(summary)` |
| Current session waits | `analyze_waits(current)` |
| I/O wait events | `analyze_waits(io)` |
| Enqueue (lock) types | `analyze_waits(enqueue)` |
| Active Session History | `analyze_waits(ash)` |
| Buffer cache hit ratio | `analyze_memory(sga)` |
| Sort spills to disk | `analyze_memory(sorts)` |
| Memory advisor advice | `analyze_memory(advisory)` |
| Tablespace full | `analyze_tablespaces(usage)` |
| Datafile near max size | `analyze_tablespaces(autoextend)` |
| Temp space issues | `analyze_tablespaces(temp)` |
| Table sizes | `analyze_tables(sizes)` |
| Stale table statistics | `analyze_tables(stale_stats)` |
| Partitioned tables | `analyze_tables(partitioned)` |
| Deep dive on one table | `investigate_table` |
| Unusable indexes | `analyze_indexes(unusable)` |
| Low cardinality indexes | `analyze_indexes(low_cardinality)` |
| Invisible indexes | `analyze_indexes(invisible)` |
| Duplicate indexes | `analyze_indexes(duplicates)` |
| Datafile I/O hotspots | `analyze_storage(io)` |
| Largest Oracle segments | `analyze_storage(segments)` |
| Storage by schema | `analyze_storage(by_schema)` |
| Redo log switch frequency | `analyze_redo` |
| ORA-01555 snapshot too old | `analyze_undo` |
| Undo space errors | `analyze_undo` |
| Stale optimizer statistics | `analyze_statistics(stale)` |
| GATHER_STATS_JOB status | `analyze_statistics(job)` |
| Data Guard apply lag | `analyze_dataguard` |
| Data Guard role check | `analyze_dataguard` |
| Oracle parameters review | `analyze_configuration(key)` |
| Non-default parameters | `analyze_configuration(non_default)` |
| Security settings | `analyze_configuration(security)` |
| Invalid objects | `analyze_schema(invalid)` |
| Tables without PK | `analyze_schema(keys)` |
| FK without index | `analyze_schema(keys)` |
| Disabled constraints | `analyze_schema(constraints)` |
| One table full structure | `table_structure` |
| Want a PDF/HTML/DOCX report | `generate_report` |

---

## Safety Rules

| Tool | Modifies database? | Note |
|------|--------------------|------|
| `run_query` | YES | Can execute any Oracle SQL — use carefully |
| `kill_session` | YES | Always try `force: false` (graceful) first |
| `suggest_index` | NO | Generates SQL, does not execute |
| `explain_query` | YES (plan_table) | Writes to PLAN_TABLE only — no data changes |
| All `analyze_*` | NO | Read-only |
| `generate_report` | NO | No Oracle access — markdown → file |
| `query_tools` | NO | Static, no DB connection |
| `query_queries` | NO | Static, no DB connection |
| `get_instructions` | NO | Reads CLAUDE.md — no DB connection |

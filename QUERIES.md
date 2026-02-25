# Natural Language Queries — Radek Oracle MCP

Phrases mapped to tools and focus parameters.

---

## Full Diagnosis

**Tool:** `auto_diagnose`

```
Run a full Oracle database diagnosis
What is wrong with my Oracle database?
Check everything — health, locks, performance, sessions
Give me an overview of all Oracle issues
Are there any critical Oracle problems right now?
What should I fix first in Oracle?
Do a complete health and performance audit of Oracle
Show me all Oracle issues sorted by severity
Diagnose only Oracle performance issues → focus_area: "performance"
Diagnose only blocking sessions and locks → focus_area: "locks"
Diagnose only session and connection issues → focus_area: "sessions"
My Oracle application is hanging — check locks and sessions
Something is wrong with Oracle — diagnose it
Is the Oracle database in good shape right now?
```

---

## Health Check

**Tool:** `health_check`

```
Is my Oracle database healthy?
What version of Oracle is running?
Show me the Oracle version
What is the buffer cache hit ratio?
How many active sessions are there?
What are the top Oracle wait events?
Are any tablespaces nearly full?
Are there blocking locks right now?
Are there invalid objects in Oracle?
What are the SGA and PGA sizes?
How much memory is Oracle using?
Is the database in archivelog mode?
What is the Oracle database role — primary or standby?
How long has Oracle been running?
Show me the Oracle database status
Is the library cache hit ratio OK?
Show redo log group status
```

---

## Sessions

**Tool:** `analyze_sessions`

```
Show all Oracle sessions → focus: "summary"
Show active Oracle sessions → focus: "active"
Which sessions have been running for a long time? → focus: "long_running"
Which user has the most Oracle sessions? → focus: "by_user"
Which machine has the most Oracle connections? → focus: "by_machine"
Which program is creating the most Oracle sessions? → focus: "by_program"
Show sleeping inactive Oracle sessions → focus: "sleeping"
Show long-running operations with progress → focus: "long_ops"
How close are we to the Oracle PROCESSES limit? → focus: "limits"
How close are we to max sessions in Oracle? → focus: "limits"
What is the current Oracle session resource utilization?
Show sessions for user SCOTT
What is running in Oracle right now?
Are there any runaway sessions in Oracle?
Are there sessions doing a large sort operation?
```

---

## Locks

**Tool:** `analyze_locks`

```
Are there any blocking Oracle sessions? → focus: "blocking"
Who is blocking whom in Oracle? → focus: "blocking"
Show Oracle lock waits → focus: "blocking"
What session should I kill to resolve the Oracle lock? → focus: "blocking"
Show all Oracle locks in v$lock → focus: "current"
What transactions are currently active in Oracle? → focus: "transactions"
Which Oracle transaction has the largest undo? → focus: "transactions"
Are there DDL lock conflicts? → focus: "ddl"
Show me the full Oracle blocking chain
Which Oracle session is causing all the waits?
Is someone holding a row lock for a long time?
Show ALTER SYSTEM KILL SESSION commands for blockers
```

---

## SQL Performance

**Tool:** `analyze_sql`

```
Which Oracle SQL is consuming the most time? → focus: "top_elapsed"
What are the top SQL statements by elapsed time? → focus: "top_elapsed"
Which Oracle queries consume the most CPU? → focus: "top_cpu"
Which SQL has the most physical disk reads? → focus: "top_disk"
Which SQL has the most logical buffer gets? → focus: "top_buffer"
Which Oracle SQL runs most often? → focus: "top_executions"
Which Oracle SQL processes the most rows? → focus: "top_rows"
What SQL is running in Oracle right now? → focus: "running"
Is the Oracle hard parse ratio too high? → focus: "parse"
Are Oracle cursors being shared efficiently? → focus: "parse"
Is there shared pool contention? → focus: "parse"
Which Oracle SQL has the most invalidations? → focus: "errors"
Which SQL is doing full table scans? → focus: "full_scans"
Show me the current SQL for all active sessions
```

**Tool:** `explain_query`

```
Explain this Oracle query: SELECT * FROM orders WHERE customer_id = 123
Show the execution plan for: SELECT o.*, c.name FROM orders o JOIN customers c ON c.id = o.customer_id
Why is this Oracle query slow?
Is this Oracle query using an index?
Does this query do a full table scan?
What is the cost estimate for this execution plan?
Show DBMS_XPLAN output for this SELECT
What access path is Oracle using for this query?
What join method is Oracle using?
Show the predicate information for this query
```

---

## Wait Events

**Tool:** `analyze_waits`

```
What are the top Oracle wait events? → focus: "summary"
Where is Oracle spending the most time waiting? → focus: "summary"
Show Oracle wait events by class → focus: "summary"
What are the current Oracle session waits? → focus: "current"
Are there I/O wait problems in Oracle? → focus: "io"
What is the db file sequential read wait time? → focus: "io"
Are there concurrency waits in Oracle? → focus: "concurrency"
Is there buffer busy wait contention? → focus: "concurrency"
What enqueue types are waiting? → focus: "enqueue"
Are there TX enqueue waits (lock waits)? → focus: "enqueue"
Are there latch contention issues? → focus: "latch"
Is there free list latch contention? → focus: "latch"
Show Oracle wait event history per session → focus: "history"
Show Active Session History for the last 10 minutes → focus: "ash"
Is log file sync causing waits in Oracle?
What is the average log file sync wait time?
Is there SQL*Net wait time?
```

---

## Memory

**Tool:** `analyze_memory`

```
How is Oracle SGA allocated? → focus: "sga"
What are the SGA dynamic components? → focus: "sga"
What is the Oracle PGA memory usage? → focus: "pga"
Is the Oracle buffer cache large enough? → focus: "advisory"
What does the DB cache advisor recommend? → focus: "advisory"
What does the shared pool advisor recommend? → focus: "advisory"
What does the PGA advisor recommend? → focus: "advisory"
Are sorts spilling to disk in Oracle? → focus: "sorts"
What is the disk sort percentage? → focus: "sorts"
Show Oracle memory initialization parameters → focus: "parameters"
Is MEMORY_TARGET or SGA_TARGET configured? → focus: "parameters"
What is the PGA_AGGREGATE_TARGET setting? → focus: "parameters"
Show SGA pool breakdown → focus: "sga"
What is the buffer pool hit rate?
```

---

## Tablespaces

**Tool:** `analyze_tablespaces`

```
Which Oracle tablespaces are nearly full? → focus: "usage"
Show Oracle tablespace usage percentages → focus: "usage"
How much free space is in each tablespace? → focus: "usage"
Show Oracle datafiles → focus: "datafiles"
Which datafiles have autoextend enabled? → focus: "datafiles"
Which Oracle datafiles are near their maximum size? → focus: "autoextend"
Is there risk of ORA-01658 unable to extend? → focus: "autoextend"
How is the Oracle temp tablespace configured? → focus: "temp"
Is the Oracle temp tablespace full? → focus: "temp"
Is the Oracle undo tablespace large enough? → focus: "undo"
Is there space fragmentation in tablespaces? → focus: "fragmentation"
How much free space is available in USERS tablespace?
Which tablespace should I add a datafile to?
```

---

## Tables

**Tool:** `analyze_tables`

```
Which Oracle tables are the largest? → focus: "sizes"
Show Oracle table segment sizes → focus: "sizes"
Show Oracle table row counts and statistics → focus: "stats"
Which Oracle tables have stale statistics? → focus: "stale_stats"
Which Oracle tables have never been analyzed? → focus: "without_stats"
Show Oracle partitioned tables → focus: "partitioned"
Which Oracle tables get the most I/O? → focus: "hot"
What are the biggest Oracle tables by row count? → focus: "rows"
```

**Tool:** `investigate_table`

```
Tell me everything about the ORDERS table
Deep dive on SCOTT.EMPLOYEES
Show full details for the PRODUCTS table
Analyze the PAYMENTS table in schema HR
What is the health of the INVOICES table?
```

**Tool:** `list_tables`

```
List all Oracle user tables
Show all tables with sizes in Oracle
What tables are in this Oracle database?
```

---

## Indexes

**Tool:** `analyze_indexes`

```
Show all Oracle indexes → focus: "overview"
Are there unusable Oracle indexes? → focus: "unusable"
Which Oracle indexes need to be rebuilt? → focus: "unusable"
Are there invisible Oracle indexes? → focus: "invisible"
Which indexes have very low cardinality in Oracle? → focus: "low_cardinality"
Are there duplicate Oracle indexes? → focus: "duplicates"
Are there redundant indexes in Oracle? → focus: "duplicates"
Which Oracle indexes have never been used? → focus: "unused"
Show Oracle index column lists → focus: "columns"
```

**Tool:** `indexes_for_table`

```
What indexes does the ORDERS table have?
Show all indexes on SCOTT.EMPLOYEES
Which indexes on CUSTOMERS might be unused?
Show the index column structure for PRODUCTS
```

**Tool:** `suggest_index`

```
Suggest an index for ORDERS on CUSTOMER_ID
Create an index on USERS for EMAIL and CREATED_DATE
Generate CREATE INDEX for PRODUCTS on CATEGORY_ID, STATUS
What index would help a query filtering ORDERS by STATUS and ORDER_DATE?
```

---

## Storage

**Tool:** `analyze_storage`

```
How much storage does each Oracle schema use? → focus: "by_schema"
What are the largest Oracle segments? → focus: "segments"
Show Oracle segment sizes by type → focus: "by_schema"
Which Oracle datafiles have the most I/O? → focus: "io"
What is the average read time per Oracle datafile? → focus: "io"
Are there active temp segment allocations? → focus: "temp"
Which Oracle tables or indexes are highly fragmented? → focus: "fragmentation"
Which Oracle segments have too many extents? → focus: "fragmentation"
How much total redo log space is allocated? → focus: "redo"
```

---

## Redo Logs

**Tool:** `analyze_redo`

```
How often are Oracle redo logs switching?
Is the Oracle redo log size appropriate?
Show Oracle redo log groups and member files
Is Oracle running in archivelog mode?
Are there frequent log switches in the last hour?
How much redo is being generated per hour?
Show recent archived log files
Is there a checkpoint performance issue?
Are there any unarchived redo log groups?
Show Oracle redo log parameters
What is the log_buffer size?
Is the log_checkpoint_interval configured correctly?
```

---

## Undo

**Tool:** `analyze_undo`

```
Are there ORA-01555 snapshot too old errors in Oracle?
What is the Oracle undo retention setting?
How much Oracle undo space is being used?
Are there undo no-space errors?
Show Oracle undo statistics over time
Which Oracle transactions have the largest undo?
What is the longest running query relative to undo retention?
Is the undo retention sufficient for long-running queries?
Show Oracle undo parameters
How is undo management configured?
```

---

## Optimizer Statistics

**Tool:** `analyze_statistics`

```
Which Oracle tables have stale statistics? → focus: "stale"
Which Oracle tables have never been analyzed? → focus: "stale"
Show all Oracle table statistics → focus: "tables"
Show Oracle index statistics → focus: "indexes"
Show Oracle column statistics and histograms → focus: "columns"
Are there pending Oracle statistics not yet published? → focus: "pending"
Is GATHER_STATS_JOB running in Oracle? → focus: "job"
What are the Oracle optimizer parameters? → focus: "optimizer"
What is the optimizer_mode set to?
Is statistics_level set to TYPICAL?
```

---

## Data Guard

**Tool:** `analyze_dataguard`

```
Is this Oracle database a primary or standby?
What is the Oracle Data Guard apply lag?
What is the Oracle redo transport lag?
Are Oracle archive log destinations healthy?
Show Oracle managed standby MRP process status
Is the Oracle standby database synchronized?
What is the Oracle Data Guard protection mode?
Is Data Guard running in MAXIMUM AVAILABILITY mode?
Are there any archive destination errors?
Show the Oracle switchover status
```

---

## Configuration

**Tool:** `analyze_configuration`

```
Show key Oracle initialization parameters → focus: "key"
What Oracle parameters have been changed from defaults? → focus: "non_default"
What are the Oracle security settings? → focus: "security"
Is auditing enabled in Oracle? → focus: "security"
Show Oracle NLS settings → focus: "nls"
What is the Oracle NLS_CHARACTERSET? → focus: "nls"
Is cursor_sharing set appropriately in Oracle? → focus: "key"
What is the Oracle UNDO_RETENTION setting? → focus: "key"
What is Oracle PROCESSES and SESSIONS set to? → focus: "key"
Show Oracle memory-related parameters → focus: "key"
Are parallel query settings configured? → focus: "key"
Is remote_os_authent disabled? → focus: "security"
What password policies are configured? → focus: "security"
Show all Oracle parameters → focus: "all_params"
```

---

## Schema Structure

**Tool:** `analyze_schema`

```
Are there invalid Oracle objects? → focus: "invalid"
How do I recompile invalid Oracle objects?
Which Oracle tables are missing a primary key? → focus: "keys"
Are there Oracle foreign keys without supporting indexes? → focus: "keys"
Are there disabled Oracle constraints? → focus: "constraints"
Show all Oracle triggers → focus: "triggers"
Show Oracle stored procedures and packages → focus: "routines"
Are there Oracle sequences? → focus: "sequences"
Show Oracle database links → focus: "dblinks"
Show Oracle views → focus: "views"
Show all Oracle objects by type → focus: "objects"
Are there schema issues I should fix? → focus: "issues"
```

**Tool:** `table_structure`

```
Show the full structure of the ORDERS table
What columns does EMPLOYEES have?
What is the primary key of PRODUCTS?
What are the foreign keys on ORDERS?
What constraints are on the PAYMENTS table?
What indexes are defined on CUSTOMERS?
What is the data type of each column in INVOICES?
```

---

## Actions

**Tool:** `run_query`

```
Run: SELECT COUNT(*) FROM orders WHERE status = 'PENDING'
Execute: SELECT * FROM v$parameter WHERE name LIKE 'sga%'
Run a custom Oracle SQL query
Count rows in the EMPLOYEES table
Show last 10 rows from AUDIT_LOG
Run: SELECT username, count(*) FROM v$session GROUP BY username
Show me what is in the PLAN_TABLE
```

**Tool:** `kill_session`

```
Kill Oracle session SID=234, SERIAL#=5678
Stop the blocking Oracle session
Kill the long-running session gracefully (SID=100 SERIAL#=4321)
Immediately kill Oracle session 50,999
Disconnect idle Oracle session SID=88
Kill the session that is blocking others
```

---

## Reports

**Tool:** `generate_report`

```
Generate an Oracle health report as PDF
Create an HTML diagnostic report for Oracle
Generate a PDF with the Oracle diagnosis results
Create a report named oracle_diagnosis_2026-02-25.pdf
Generate a full Oracle assessment Word document
Create a DOCX report using the Assessment template with company branding
Export the Oracle analysis as a branded .docx file
Save the Oracle database assessment as HTML
Generate a fragmentation report as PDF
Create an Oracle performance report in Word format
```

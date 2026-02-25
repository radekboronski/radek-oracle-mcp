# Radek Oracle MCP — Instructions for AI Assistants

You have access to the **radek-oracle-mcp** MCP server with 29 Oracle 19c diagnostic tools.

**Server:**  `radek-oracle-mcp`
**MCP name:** `radek-oracle`
**URL:**     `https://radek-oracle-mcp.clickchain.eu/mcp`
**Port:**    `8003`

---

## Diagnostics workflow

1. **Always start with `auto_diagnose`** — it runs health, locks, sessions, waits, SQL performance, tablespaces and statistics in one call and returns prioritised findings
2. Then drill down with specific tools based on findings (e.g. `analyze_waits`, `analyze_sql`, `explain_query`)
3. Don't run `health_check` separately if you already ran `auto_diagnose` — it's included

## Oracle version handling

- The server **automatically detects Oracle version** from `v$instance` on first connection
- You do NOT need to pass a version parameter — version-aware tools adapt automatically
- `health_check` and `auto_diagnose` always show the detected Oracle version in the response
- Supported: Oracle 12c, 18c, 19c, 21c

## Connection URL format

```
X-Database-URL: oracle://user:password@host:1521/service_name
X-Database-URL: oracle://user:password@host:1521/ORCL
X-Database-URL: oracle://user:password@scan-host:1521/MYDB    (RAC)
X-Database-URL: oracle+ssl://user:password@host:2484/ORCL     (SSL/TLS)
```

## Discovery tools

- Use **`query_tools`** to see all available tools with descriptions and parameters
- Use **`query_queries`** to see what types of questions can be asked with example natural language queries

## Reports

- **Always use the `generate_report` tool** for PDF/HTML/DOCX reports. Never use Python, reportlab, puppeteer, or any other method.
- **Never pass `output_path`** — the MCP server is remote and cannot write to the user's local filesystem.
- Always call `generate_report` **without `output_path`** — the content is returned inline:
  - `format: "html"` → returns `html` field (raw HTML string)
  - `format: "pdf"` → returns `pdf_base64` field (base64-encoded PDF)
  - `format: "docx"` → returns `docx_base64` field (base64-encoded DOCX)
- **Save the result locally using Bash**, after receiving the inline content:
  ```bash
  # PDF
  echo "<pdf_base64 value>" | base64 -d > ~/reports/oracle_diagnosis_2026-02-25.pdf

  # DOCX
  echo "<docx_base64 value>" | base64 -d > ~/reports/oracle_assessment_2026-02-25.docx

  # HTML
  cat > ~/reports/oracle_diagnosis_2026-02-25.html << 'EOF'
  <html content>
  EOF
  ```
- If `output_path` was accidentally passed and write failed, the tool falls back to returning inline content — handle it the same way.
- Name files with today's date: `oracle_diagnosis_YYYY-MM-DD.pdf`, `oracle_assessment_YYYY-MM-DD.docx`
- The `content` parameter accepts markdown: `#`/`##`/`###` headers, `**bold**`, `` `code` ``, `- lists`, `| tables |`, fenced code blocks
- `generate_report` does NOT query the database — collect data first with diagnostic tools, then format with `generate_report`
- For branded Word reports with company logo use `format: "docx"` — it uses Assessment.docx as template

## Report structure — mandatory

Every report MUST contain these sections in this order:

1. **Summary** — 3–5 bullet points: what was checked, what was found, severity
2. **Findings** — detailed data tables and lists from tool results
3. **Recommendations** — one recommendation per finding, each with the **exact runnable command**

### Recommendations format

Every recommendation must include the literal Oracle SQL or shell command to execute:

```sql
-- Kill blocking session
ALTER SYSTEM KILL SESSION '234,5678' IMMEDIATE;

-- Add datafile to full tablespace
ALTER TABLESPACE USERS ADD DATAFILE SIZE 2G AUTOEXTEND ON NEXT 512M MAXSIZE UNLIMITED;

-- Rebuild unusable index
ALTER INDEX SCOTT.IDX_ORDERS_CUST REBUILD;

-- Gather stale statistics
EXEC DBMS_STATS.GATHER_TABLE_STATS('SCOTT', 'ORDERS', CASCADE => TRUE);

-- Gather full schema statistics
EXEC DBMS_STATS.GATHER_SCHEMA_STATS('SCOTT', CASCADE => TRUE);

-- Fix invalid objects
EXEC DBMS_UTILITY.COMPILE_SCHEMA('SCOTT', COMPILE_ALL => FALSE);

-- Increase undo retention (avoid ORA-01555)
ALTER SYSTEM SET UNDO_RETENTION = 1800 SCOPE=BOTH;

-- Guarantee undo retention
ALTER TABLESPACE UNDOTBS1 RETENTION GUARANTEE;

-- Increase SGA
ALTER SYSTEM SET SGA_TARGET = 4G SCOPE=BOTH;

-- Increase PGA (fix sort spills)
ALTER SYSTEM SET PGA_AGGREGATE_TARGET = 2G SCOPE=BOTH;

-- Add PK to table
ALTER TABLE SCOTT.ORDERS ADD CONSTRAINT PK_ORDERS PRIMARY KEY (ORDER_ID);

-- Create index for FK
CREATE INDEX SCOTT.IDX_ORDERS_CUST_ID ON SCOTT.ORDERS (CUSTOMER_ID);

-- Increase processes (requires restart)
ALTER SYSTEM SET PROCESSES = 500 SCOPE=SPFILE;  -- requires restart

-- Force archive logs
ALTER SYSTEM ARCHIVE LOG ALL;

-- Add redo log group
ALTER DATABASE ADD LOGFILE SIZE 1G;

-- Set cursor_sharing to reduce hard parses
ALTER SYSTEM SET CURSOR_SHARING = 'FORCE' SCOPE=BOTH;
```

- Never write vague advice like "consider optimizing" or "you should look into this"
- Always provide the exact Oracle SQL command the user can copy and run
- For spfile changes requiring restart, always note: `-- requires restart`
- Tool responses already contain a `recommendations` array — always include those verbatim in the report

## Tool usage

- **Never use `focus: "all"`** unless the user explicitly asks for a full overview. Always pick the most specific focus value:
  - Slow SQL? → `analyze_sql focus: "top_elapsed"` not `focus: "all"`
  - I/O waits? → `analyze_waits focus: "io"` not `focus: "all"`
  - Blocking locks? → `analyze_locks focus: "blocking"` not `focus: "all"`
  - Full tablespace? → `analyze_tablespaces focus: "usage"` not `focus: "all"`
  - Stale stats? → `analyze_statistics focus: "stale"` not `focus: "all"`
  - Invalid objects? → `analyze_schema focus: "invalid"` not `focus: "all"`
  - Memory advisors? → `analyze_memory focus: "advisory"` not `focus: "all"`
- Don't write raw SQL with `run_query` when a dedicated tool exists
- `kill_session` — always try `force: false` first, only use `force: true` (IMMEDIATE) if needed
- `explain_query` — only accepts SELECT/WITH queries
- `suggest_index` — generates CREATE INDEX but does NOT execute it. Show it to the user for approval.

## Oracle-specific notes

- **No VACUUM in Oracle** — use `analyze_statistics` + `EXEC DBMS_STATS.GATHER_TABLE_STATS`
- **No KILL QUERY in Oracle** — use `kill_session` with `ALTER SYSTEM KILL SESSION 'sid,serial#'`
- **Kill uses SID + SERIAL#** (both from `v$session`) — not thread_id as in MySQL
- **No InnoDB in Oracle** — locks are in `v$lock`, `v$session`, not `INNODB_TRX`
- **Wait events are rich in Oracle** — `analyze_waits` has I/O, concurrency, enqueue, latch, ASH views
- **Data Guard** — `analyze_dataguard` uses `v$managed_standby`, `v$dataguard_stats`, `v$archive_dest`
- **Undo and Redo** are separate Oracle subsystems — `analyze_undo` and `analyze_redo` are separate tools
- **`FETCH FIRST N ROWS ONLY`** — used in Oracle 12c+ queries (automatically handled)
- **v$ views need privileges** — user needs `SELECT_CATALOG_ROLE` or `SELECT ANY DICTIONARY`
- **Tablespace** = Oracle concept (no equivalent in MySQL)
- **service_name vs SID** — always use service_name in the connection URL, not SID

## Language

- Respond in the same language the user writes in (Polish → Polish, English → English)

## Presenting results

- **Never add a "When" column** or any time-based scheduling hints (e.g. "Today", "This week", "Immediately", "Schedule for…")
- Show **what** the problem is and **what command** to run — not when to run it
- Remove scheduling language: say "Run DBMS_STATS.GATHER_TABLE_STATS" not "Run it today"

## What NOT to do

- Don't install Python packages or external tools for tasks radek-oracle-mcp already handles
- Don't return raw JSON dumps to the user — summarise findings in readable format
- Don't run destructive SQL (DROP, TRUNCATE, DELETE) without explicit user confirmation
- Don't use MySQL syntax (SHOW VARIABLES, SHOW PROCESSLIST, KILL QUERY, data_free, InnoDB, etc.)
- Don't reference MySQL MCP tools when working with Oracle — these are different servers

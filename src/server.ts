#!/usr/bin/env node
// Radek Oracle MCP — Oracle 19c diagnostic server for AI tools (Claude, Cursor)

import http from 'http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { loadConfig } from './config';
import { handleMcpRequest } from './mcp-handler';
import { TOOL_LIST } from './tools/index';
import { BANNER_BOX } from './banner';
import * as log from './logger';
import type { McpRequest } from './types';

const config = loadConfig();
const SECRET = config.auth.secret;
const PORT = config.server?.port ?? 8003;
const DB_URL = config.database?.url ?? '';
const sessions = new Map<string, boolean>();

// ─── Auth ─────────────────────────────────────────────────────────────────────

function verifyToken(req: http.IncomingMessage): { ok: boolean; error?: string; decoded?: jwt.JwtPayload | string } {
  const auth = req.headers['authorization'] ?? '';
  if (!auth.startsWith('Bearer ')) return { ok: false, error: 'Missing Authorization header' };
  try {
    const decoded = jwt.verify(auth.slice(7), SECRET);
    return { ok: true, decoded };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' };
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function sendJSON(res: http.ServerResponse, status: number, data: unknown, extra: Record<string, string> = {}): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID, X-Database-URL',
    'Access-Control-Expose-Headers': 'MCP-Session-Id',
    ...extra,
  });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'OPTIONS') { sendJSON(res, 200, {}); return; }

  if (req.method === 'GET' && pathname === '/health') {
    sendJSON(res, 200, { status: 'ok', server: 'Radek Oracle MCP', version: '1.0.0', tools: TOOL_LIST.length });
    return;
  }

  if (pathname === '/.well-known/oauth-protected-resource') {
    const base = (req.headers['x-forwarded-proto'] ?? 'https') + '://' + (req.headers['x-forwarded-host'] ?? req.headers.host);
    sendJSON(res, 200, { resource: base, bearer_methods_supported: ['header'] });
    return;
  }
  if (pathname === '/.well-known/oauth-authorization-server') {
    sendJSON(res, 404, { error: 'not_found', error_description: 'This server uses static JWT tokens. Provide Authorization: Bearer <token>' });
    return;
  }

  if (req.method === 'DELETE' && pathname === '/mcp') {
    res.writeHead(200, { 'Content-Length': '0', 'Access-Control-Allow-Origin': '*' });
    res.end();
    return;
  }

  if (req.method !== 'POST' || pathname !== '/mcp') {
    sendJSON(res, 404, { error: 'not_found' });
    return;
  }

  console.log('>>> POST /mcp');

  const auth = verifyToken(req);
  if (!auth.ok) {
    log.warn(`Auth failed from ${req.socket.remoteAddress ?? 'unknown'}: ${auth.error}`);
    sendJSON(res, 401, { error: auth.error });
    return;
  }
  const decoded = auth.decoded as jwt.JwtPayload;
  console.log(`  Auth OK: ${decoded?.name ?? decoded?.sub ?? 'unknown'}`);

  // DB URL from request header, fall back to config, then empty string
  const dbUrl = (req.headers['x-database-url'] as string) ?? DB_URL ?? '';

  const body = await readBody(req);
  let mcpReq: McpRequest;
  try { mcpReq = JSON.parse(body) as McpRequest; }
  catch { sendJSON(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); return; }

  const { method, id } = mcpReq;
  console.log(`  MCP: ${method} id=${String(id)}`);

  const extra: Record<string, string> = {};
  if (method === 'initialize') {
    const sid = crypto.randomBytes(16).toString('hex');
    sessions.set(sid, true);
    extra['MCP-Session-Id'] = sid;
  }

  const result = await handleMcpRequest(mcpReq, dbUrl);
  sendJSON(res, 200, result, extra);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(BANNER_BOX);
  console.log(`
  Endpoint:  http://0.0.0.0:${PORT}/mcp
  Auth:      JWT Bearer token
  Database:  dynamic via X-Database-URL request header
             Format: oracle://user:password@host:1521/service_name

  Tools (${TOOL_LIST.length}):
  ──────────────────────────────────────────────────────────────
  auto_diagnose         Full automatic Oracle diagnosis
  health_check          Quick DB health: version, SGA, sessions, waits
  analyze_sessions      Sessions by user/machine/program, long-running, long ops
  analyze_locks         Blocking chains, lock waits, active transactions, DDL locks
  analyze_sql           Top SQL by elapsed/CPU/disk/buffer/executions
  explain_query         EXPLAIN PLAN FOR + DBMS_XPLAN.DISPLAY
  analyze_waits         Wait events, wait classes, enqueues, latches, ASH
  analyze_memory        SGA/PGA components, advisors, sort overflow
  analyze_tablespaces   Usage, datafiles, free space, temp, autoextend risk
  analyze_tables        Sizes, stats, stale stats, partitions
  investigate_table     Deep dive on one table
  analyze_indexes       Unused, low cardinality, invisible, unusable, duplicates
  indexes_for_table     Indexes for a specific table
  suggest_index         Generate CREATE INDEX (does NOT execute)
  analyze_storage       Segments by schema, I/O, extent fragmentation
  analyze_redo          Redo log groups, switch frequency, archivelog status
  analyze_undo          Undo stats, ORA-01555 risk, undo segments
  analyze_statistics    Stale/missing optimizer stats, gather_stats_job
  analyze_dataguard     Data Guard status, apply/transport lag, archive dests
  analyze_configuration Key parameters, non-default, security settings
  analyze_schema        Invalid objects, tables without PK, FK without index
  table_structure       Columns, constraints, indexes for one table
  run_query             Execute any SQL query
  list_tables           All user tables with sizes
  kill_session          ALTER SYSTEM KILL SESSION 'sid,serial#'
  generate_report       Generate PDF / HTML / DOCX report
  query_tools           List all available tools
  query_queries         Example natural-language questions
  get_instructions      Return CLAUDE.md instructions
`);
});

import { TOOL_LIST, callTool, NO_DB_TOOLS } from './tools/index';
import * as log from './logger';
import type { McpRequest, McpResponse } from './types';

const ok = (id: McpRequest['id'], result: unknown): McpResponse => ({ jsonrpc: '2.0', id, result });
const err = (id: McpRequest['id'], code: number, message: string): McpResponse => ({ jsonrpc: '2.0', id, error: { code, message } });
const text = (value: unknown) => [{ type: 'text', text: JSON.stringify(value, null, 2) }];

export async function handleMcpRequest(
  mcpReq: McpRequest,
  dbUrl: string
): Promise<McpResponse> {
  const { method, id, params = {} } = mcpReq;

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: { name: 'Radek Oracle MCP', version: '1.0.0' },
    });
  }

  if (method === 'notifications/initialized') return ok(id, {});

  if (method === 'tools/list') return ok(id, { tools: TOOL_LIST });

  if (method === 'tools/call') {
    const name = (params as { name?: string }).name ?? '';
    const args = (params as { arguments?: Record<string, unknown> }).arguments ?? {};

    if (!dbUrl && !NO_DB_TOOLS.has(name)) {
      return ok(id, { content: text({ error: 'No database configured. Check db.config.json or pass X-Database-URL header.' }) });
    }

    try {
      const result = await callTool(name, dbUrl, args);
      return ok(id, { content: text(result) });
    } catch (e) {
      log.error(`tool:${name} threw unhandled exception`, e);
      return ok(id, { content: text({ error: (e as Error).message }) });
    }
  }

  return err(id, -32601, `Unknown method: ${method}`);
}

export interface DbConfig {
  database?: {
    url?: string;
  };
  auth: {
    secret: string;
  };
  server?: {
    port?: number;
    tunnel_url?: string;
  };
}

export interface McpRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface ToolDef {
  fn: (dbUrl: string, args: Record<string, unknown>) => Promise<unknown>;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolListEntry {
  name: string;
  description: string;
  inputSchema: ToolDef['schema'];
}

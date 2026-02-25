#!/usr/bin/env node
/**
 * Radek Oracle MCP — JWT token generator
 *
 * Server:   radek-oracle-mcp
 * MCP name: radek-oracle
 * URL:      https://radek-oracle-mcp.clickchain.eu/mcp
 * Port:     8003
 *
 * Usage:
 *   node dist/create-token.js --init
 *   node dist/create-token.js --name claude --days 365
 *   node dist/create-token.js --name cursor --days 90
 *   npx ts-node src/create-token.ts --name myapp --days 30
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const get = (flag: string, def = '') => {
  const i = args.indexOf(flag);
  return i !== -1 ? (args[i + 1] ?? def) : def;
};

const configPath = join(process.cwd(), 'db.config.json');

if (args.includes('--init')) {
  const secret = crypto.randomBytes(32).toString('hex');
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch (_) { /* ignore */ }
  }
  if (!config.auth) config.auth = {};
  (config.auth as Record<string, unknown>).secret = secret;
  if (!config.server) config.server = {};
  (config.server as Record<string, unknown>).port = 8003;
  (config.server as Record<string, unknown>).tunnel_url = 'https://radek-oracle-mcp.clickchain.eu';
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`Generated secret and saved to db.config.json`);
  console.log(`Secret: ${secret}`);
  console.log(`Server: radek-oracle-mcp`);
  console.log(`URL:    https://radek-oracle-mcp.clickchain.eu/mcp`);
  process.exit(0);
}

let SECRET = '';
let TUNNEL_URL = '';
if (existsSync(configPath)) {
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
    SECRET = cfg.auth?.secret ?? '';
    TUNNEL_URL = cfg.server?.tunnel_url ?? '';
  } catch (_) { /* ignore */ }
}
if (!SECRET) {
  console.error('ERROR: No secret found in db.config.json.');
  console.error('Run: node dist/create-token.js --init');
  process.exit(1);
}

const name = get('--name', 'client');
const days = parseInt(get('--days', '365'), 10);

const token = jwt.sign({ name, sub: name, iat: Math.floor(Date.now() / 1000) }, SECRET, { expiresIn: `${days}d` });
const decoded = jwt.decode(token) as Record<string, unknown>;

const mcpUrl     = TUNNEL_URL ? `${TUNNEL_URL}/mcp` : 'https://radek-oracle-mcp.clickchain.eu/mcp';
const serverName = 'radek-oracle';

const mcpJson = JSON.stringify({
  mcpServers: {
    [serverName]: {
      type: 'http',
      url: mcpUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Database-URL': 'oracle://user:password@host:1521/ORCL',
      },
    },
  },
}, null, 2);

console.log(`\n${'═'.repeat(70)}`);
console.log(`  Radek Oracle MCP — Token Generator`);
console.log(`  Server:  radek-oracle-mcp`);
console.log(`  MCP:     radek-oracle`);
console.log(`  URL:     https://radek-oracle-mcp.clickchain.eu/mcp`);
console.log(`${'═'.repeat(70)}`);
console.log(`\nToken for "${name}" (expires in ${days} days):\n`);
console.log(token);
console.log(`\nDecoded payload:\n`);
console.log(JSON.stringify(decoded, null, 2));
console.log(`\n${'─'.repeat(70)}`);
console.log(`Claude Code — create .mcp.json in your project directory:`);
console.log(`${'─'.repeat(70)}\n`);
console.log(mcpJson);
console.log(`\n${'─'.repeat(70)}`);
console.log(`Cursor — create .cursor/mcp.json in your project directory:`);
console.log(`${'─'.repeat(70)}\n`);
console.log(mcpJson);
console.log(`\n${'─'.repeat(70)}`);
console.log(`Claude Code CLI:`);
console.log(`${'─'.repeat(70)}\n`);
console.log(`TOKEN="${token}"`);
console.log(`DB="oracle://user:password@host:1521/ORCL"\n`);
console.log(`claude mcp add radek-oracle https://radek-oracle-mcp.clickchain.eu/mcp \\`);
console.log(`  --transport http \\`);
console.log(`  --header "Authorization: Bearer $TOKEN" \\`);
console.log(`  --header "X-Database-URL: $DB" \\`);
console.log(`  --scope local`);
console.log(`\n${'─'.repeat(70)}`);
console.log(`X-Database-URL format for Oracle:`);
console.log(`  oracle://user:password@host:1521/service_name`);
console.log(`  oracle://user:password@host:1521/ORCL`);
console.log(`  oracle://user:password@scan-host:1521/MYDB   (RAC)`);
console.log(`  oracle+ssl://user:password@host:2484/ORCL    (SSL/TLS)`);

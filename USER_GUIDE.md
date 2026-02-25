# User Guide — Radek Oracle MCP

How to start the server, configure Cloudflare Tunnel, and connect Claude Code / Cursor.

---

## Connection Architecture

Every request requires **two headers**:

```
Authorization: Bearer <token>           ← client authentication (JWT)
X-Database-URL: oracle://user:pass@host:1521/service   ← Oracle connection for this request
```

The JWT token verifies client identity. The database address is **never stored on the server** — the client provides it on every call. One server instance can serve multiple Oracle databases.

---

## Step 1 — Install and configure

```bash
cd radek-oracle-mcp
npm install
cp db.config.example.json db.config.json
```

Edit `db.config.json`:

```json
{
  "auth": {
    "secret": ""
  },
  "server": {
    "port": 8003,
    "tunnel_url": "https://radek-oracle-mcp.clickchain.eu"
  }
}
```

`tunnel_url` is optional. When set, the token generator automatically embeds it in the `.mcp.json` block.

---

## Step 2 — Build and generate a secret

```bash
npm run build
node dist/create-token.js --init
```

`--init` generates a random 64-char hex string and saves it to `db.config.json → auth.secret`. Run only once on first setup — changing the secret invalidates all existing tokens.

---

## Step 3 — Generate a JWT token

```bash
npm run token -- --name <name> --days <validity>
```

Examples:

```bash
npm run token -- --name claude --days 365
npm run token -- --name cursor --days 90
npm run token -- --name ci-bot --days 365
```

Output:

```
Token for "claude" (expires in 365 days):

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

────────────────────────────────────────────────────────────
Claude Code — create .mcp.json in your project directory:
────────────────────────────────────────────────────────────

{
  "mcpServers": {
    "radek-oracle": {
      "type": "http",
      "url": "https://radek-oracle-mcp.clickchain.eu/mcp",
      "headers": {
        "Authorization": "Bearer eyJhbGci...",
        "X-Database-URL": "oracle://user:password@host:1521/ORCL"
      }
    }
  }
}
```

**Replace the `X-Database-URL` placeholder with your actual Oracle connection string** before pasting into the client.

---

## Step 4 — Start the server

```bash
clear && lsof -ti :8003 | xargs kill 2>/dev/null; npm run build && npm start
```

Server starts at `http://0.0.0.0:8003/mcp`.

Verify it is running:

```bash
curl http://localhost:8003/health
# {"status":"ok","server":"Radek Oracle MCP","version":"1.0.0","tools":29}
```

---

## Step 5 — Cloudflare Tunnel (remote access)

### One-time setup

```bash
# 1. The tunnel radek-oracle-mcp was already created:
#    ID: ffcf0846-8f91-4687-a312-989ac2e11835
#    DNS: radek-oracle-mcp.clickchain.eu  (CNAME → Cloudflare)

# 2. Config file at:
cat ~/.cloudflared/config-radek-oracle-mcp.yml
# credentials-file: /home/mcp/.cloudflared/ffcf0846-8f91-4687-a312-989ac2e11835.json
# ingress:
#   - hostname: radek-oracle-mcp.clickchain.eu
#     service: http://127.0.0.1:8003
#   - service: http_status:404

# 3. Start tunnel
cloudflared tunnel --config ~/.cloudflared/config-radek-oracle-mcp.yml run radek-oracle-mcp
```

### As a systemd service

```bash
# Create service file
sudo tee /etc/systemd/system/cloudflared-radek-oracle-mcp.service > /dev/null << 'EOF'
[Unit]
Description=Cloudflare Tunnel — radek-oracle-mcp
After=network.target

[Service]
User=mcp
ExecStart=/usr/bin/cloudflared tunnel --config /home/mcp/.cloudflared/config-radek-oracle-mcp.yml run radek-oracle-mcp
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cloudflared-radek-oracle-mcp
sudo systemctl start cloudflared-radek-oracle-mcp
sudo systemctl status cloudflared-radek-oracle-mcp
```

### Verify tunnel is active

```bash
cloudflared tunnel list
# radek-oracle-mcp  ffcf0846-...  2026-02-25  1xfra03, 1xfra06 ...

curl https://radek-oracle-mcp.clickchain.eu/health
# {"status":"ok","server":"Radek Oracle MCP","version":"1.0.0","tools":29}
```

---

## Claude Code Configuration

### Option A — `.mcp.json` file

Create `.mcp.json` in your project directory:

```json
{
  "mcpServers": {
    "radek-oracle": {
      "type": "http",
      "url": "https://radek-oracle-mcp.clickchain.eu/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>",
        "X-Database-URL": "oracle://user:password@host:1521/ORCL"
      }
    }
  }
}
```

### Option B — Claude Code CLI

```bash
TOKEN="<your-token>"
DB="oracle://user:password@host:1521/ORCL"

claude mcp add radek-oracle https://radek-oracle-mcp.clickchain.eu/mcp \
  --transport http \
  --header "Authorization: Bearer $TOKEN" \
  --header "X-Database-URL: $DB" \
  --scope local
```

---

## Cursor Configuration

Create `.cursor/mcp.json` in your project directory:

```json
{
  "mcpServers": {
    "radek-oracle": {
      "type": "http",
      "url": "https://radek-oracle-mcp.clickchain.eu/mcp",
      "headers": {
        "Authorization": "Bearer <your-token>",
        "X-Database-URL": "oracle://user:password@host:1521/ORCL"
      }
    }
  }
}
```

---

## Oracle Connection URL Format

```
oracle://user:password@host:1521/service_name
oracle://user:password@host:1521/ORCL
oracle://user:password@scan-host:1521/MYDB    (Oracle RAC)
oracle+ssl://user:password@host:2484/ORCL     (SSL/TLS)
```

| Part | Example | Notes |
|------|---------|-------|
| user | `system` | Oracle username |
| password | `secret` | URL-encode special chars (`@` → `%40`, `#` → `%23`) |
| host | `db.example.com` | Hostname or IP |
| port | `1521` | Default Oracle listener port |
| service_name | `ORCL` | Oracle service name (not SID) |
| `oracle+ssl://` | — | Use for SSL/TLS connections (port usually 2484) |

### Oracle RAC (Real Application Clusters)

```
oracle://user:password@scan-hostname:1521/MYDB_SERVICE
```

Use the SCAN (Single Client Access Name) hostname and the service name, not the SID.

---

## Required Oracle Privileges

The connecting user needs read access to system views:

```sql
-- Minimum: read-only access to data dictionary
GRANT CREATE SESSION TO mcp_user;
GRANT SELECT_CATALOG_ROLE TO mcp_user;
GRANT SELECT ANY DICTIONARY TO mcp_user;

-- For explain_query (creates PLAN_TABLE):
GRANT CREATE ANY TABLE TO mcp_user;
GRANT DROP ANY TABLE TO mcp_user;

-- Simplest (for diagnostic environments):
GRANT DBA TO mcp_user;
```

---

## Multiple Oracle Databases from One Server

One running server can connect to multiple Oracle databases. Each project/client specifies its own `X-Database-URL`:

```json
// Project A — production Oracle
"X-Database-URL": "oracle://user:pass@prod-oracle:1521/PRODDB"

// Project B — development Oracle
"X-Database-URL": "oracle://user:pass@dev-oracle:1521/DEVDB"

// Project C — Oracle RAC
"X-Database-URL": "oracle://user:pass@scan-host:1521/RACDB"
```

---

## Token Management

```bash
# Generate tokens for different clients
npm run token -- --name claude --days 365
npm run token -- --name cursor --days 90
npm run token -- --name ci-bot --days 365
npm run token -- --name team-lead --days 30
```

### Token Rotation — invalidate all tokens

```bash
# 1. Generate a new secret
node dist/create-token.js --init

# 2. Restart the server
lsof -ti :8003 | xargs kill && npm start

# 3. Generate new tokens for all clients
npm run token -- --name claude --days 365
npm run token -- --name cursor --days 90
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Missing Authorization header` | Add `Authorization: Bearer <token>` header |
| `Token expired` | Generate new token: `npm run token -- --name X --days 365` |
| `Invalid token` | Check `auth.secret` has not changed since token was generated |
| `No database configured` | Add `X-Database-URL: oracle://...` header to client config |
| `Connection refused :8003` | Start the server: `npm start` |
| `502 Bad Gateway` | Server on port 8003 is not running — start before the tunnel |
| `db.config.json not found` | Run: `cp db.config.example.json db.config.json` |
| `ORA-01017: invalid username/password` | Check Oracle username and password in `X-Database-URL` |
| `ORA-12541: no listener` | Check Oracle host and port 1521 in `X-Database-URL` |
| `ORA-12514: listener does not know of service` | Check service name in `X-Database-URL` (use service, not SID) |
| `ORA-00942: table or view does not exist` | User needs `SELECT_CATALOG_ROLE` or `SELECT ANY DICTIONARY` |
| `ORA-01031: insufficient privileges` | Grant `SELECT_CATALOG_ROLE` to the Oracle user |
| Cursor does not see MCP | Check `.cursor/mcp.json` and restart Cursor |
| Claude Code does not see MCP | Check `.mcp.json` or run `/mcp` in Claude Code |
| Tunnel not connecting | Run: `cloudflared tunnel list` and check status |

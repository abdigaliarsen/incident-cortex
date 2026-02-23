# MCP Server Setup for Incident Cortex

Incident Cortex exposes all 10 ES|QL investigation tools via the Model Context Protocol (MCP), allowing any MCP-compatible client (Claude Desktop, VS Code, etc.) to use them directly.

## Protocol Details

- **Transport**: Streamable HTTP (JSON-RPC over POST)
- **Endpoint**: `https://incident-cortex-a55afb.kb.us-central1.gcp.elastic.cloud/api/agent_builder/mcp`
- **Authentication**: API Key via `Authorization: ApiKey <key>` header
- **Protocol Version**: 2024-11-05

## Claude Desktop Setup

1. Copy `claude_desktop_config.json` to your Claude Desktop config directory:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/claude/claude_desktop_config.json`

2. Replace `YOUR_API_KEY_HERE` with your Elasticsearch API key.

3. Restart Claude Desktop.

4. You should see "incident-cortex" listed in Claude's MCP server connections.

## Available Tools

All 10 ES|QL investigation tools are exposed:

| Tool | Description |
|------|-------------|
| `ic-service-health-overview` | Health overview of all services |
| `ic-find-error-spike` | Detect error rate spikes in logs |
| `ic-correlate-trace` | Follow distributed traces |
| `ic-find-first-occurrence` | Find when errors first appeared |
| `ic-detect-metric-anomaly` | Detect CPU/memory/latency anomalies |
| `ic-correlate-deploy-metric` | Correlate deployments with metrics |
| `ic-get-deployments` | List recent deployments |
| `ic-check-security-alerts` | Query security alerts |
| `ic-investigate-ip` | Investigate suspicious IPs |
| `ic-search-similar-incidents` | Search past incidents |

## Testing

Test the MCP endpoint manually:

```bash
curl -X POST \
  -H "Authorization: ApiKey YOUR_API_KEY" \
  -H "kbn-xsrf: true" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' \
  https://incident-cortex-a55afb.kb.us-central1.gcp.elastic.cloud/api/agent_builder/mcp
```

Expected response: `{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"elastic-mcp-server","version":"0.0.1"}},"jsonrpc":"2.0","id":1}`

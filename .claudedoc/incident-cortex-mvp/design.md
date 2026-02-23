# Incident Cortex MVP -- Design

## Architecture Overview

Multi-agent SRE & Security autopilot built on Elastic Agent Builder. Four specialized agents coordinate via A2A protocol to investigate incidents across logs, metrics, and security signals, then execute remediation via Elastic Workflows.

```
                    +----------------------+
                    |   Alert / User Chat  |
                    +---------+------------+
                              |
                    +---------v------------+
                    |   TRIAGE AGENT       |
                    |  (Coordinator)       |
                    |  - Classifies alert  |
                    |  - Routes to agents  |
                    |  - Synthesizes RCA   |
                    +--+------+------+-----+
                       |      |      |        A2A Protocol
              +--------v--+ +-v----+ +v------------+
              | LOG       | |METRIC| | SECURITY    |
              | ANALYZER  | |AGENT | | AGENT       |
              +-----------+ +------+ +-------------+
                    |          |             |
                    +----------+-------------+
                               |
                    +----------v-----------+
                    |  REMEDIATION ENGINE  |
                    |  (Elastic Workflows) |
                    +----------+-----------+
                               |
                    +----------v-----------+
                    |  INCIDENT REPORT     |
                    |  (ES Index + MCP)    |
                    +----------------------+
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Agents | Elastic Agent Builder (Kibana API) | LLM-powered investigation agents |
| Agent Coordination | A2A Protocol (Google) | Multi-agent message passing |
| Data Queries | ES\|QL (parameterized) | Custom investigation tools |
| Remediation | Elastic Workflows (YAML + Liquid) | Automated response actions |
| External Access | Native Elastic MCP Server | IDE/Claude Desktop integration |
| Search | Elasticsearch Serverless | All data storage and retrieval |
| Embeddings | semantic_text + ELSER | Threat intelligence semantic search |
| Frontend | Next.js + React + Tailwind | Chat UI for SRE interaction |
| Data Generation | Python (Faker + elasticsearch-py) | Synthetic incident scenario |

## Data Model

### Elasticsearch Indices (7)

**`logs-incident-cortex`** -- Application and infrastructure logs
- Fields: `@timestamp`, `service.name`, `log.level`, `message`, `trace.id`, `host.name`, `error.type`, `error.stack_trace`
- Volume: ~10K documents across 5 services

**`metrics-incident-cortex`** -- CPU, memory, latency, error rates (time-series)
- Fields: `@timestamp`, `host.name`, `service.name`, `system.cpu.total.pct`, `system.memory.used.pct`, `http.response.latency_ms`, `http.response.status_code`, `http.request.count`
- Volume: ~14K documents (10 hosts x 1440 minutes)

**`security-alerts-incident-cortex`** -- SIEM alerts, threat intelligence, IOCs
- Fields: `@timestamp`, `event.category`, `event.action`, `source.ip`, `destination.ip`, `user.name`, `alert.severity`, `alert.rule_name`, `message`
- Volume: ~250 events including brute-force pattern

**`deployments-incident-cortex`** -- Deployment history for correlation
- Fields: `@timestamp`, `deployment.version`, `deployment.service`, `deployment.author`, `deployment.status`, `deployment.commit_sha`, `deployment.changes`
- Volume: 20 records

**`threat-intel-incident-cortex`** -- CVE database, known threat actor patterns
- Fields: `indicator.ip`, `indicator.type`, `threat.description` (semantic_text), `threat.severity`, `threat.actor`, `cve.id`, `last_seen`
- Volume: 50 entries with ELSER embeddings

**`incidents-incident-cortex`** -- Generated incident reports (written by agent)
- Fields: `@timestamp`, `incident.id`, `incident.severity`, `incident.status`, `incident.title`, `incident.root_cause`, `incident.remediation`, `incident.agents_involved`, `incident.timeline` (nested)

**`incident-cortex-notifications`** -- Simulated Slack/Jira notifications (written by Workflows)
- Fields: `timestamp`, `channel`, `severity`, `message`, `type`

### Synthetic Incident Scenario

All data synthetic (hackathon rule). One coherent scenario with interconnected signals:

- **Services**: `payment-service`, `user-service`, `api-gateway`, `notification-service`, `inventory-service`
- **Hosts**: `node-1` through `node-10`
- **Timeline**: 24 hours of baseline + incident window (14:25-14:45 UTC)
  - 14:25: Brute-force login attempts from `203.0.113.42` begin
  - 14:28: Deployment v2.4.1 of `payment-service` by "deploy-bot"
  - 14:30: `payment-service` starts throwing `NullPointerException` on `node-3`, `node-7`
  - 14:30: CPU spike on `node-3` correlates with deployment
  - 14:32: Latency spike propagates to `api-gateway`
  - 14:35: Error rate exceeds threshold, alerts fire

## Agent Design

### Triage Agent (Coordinator)
- **ID**: `incident-cortex-triage`
- **Color**: `#FF6B6B` (red), Symbol: `TR`
- **Role**: Classifies incidents as OPERATIONAL, SECURITY, or BOTH. Routes to specialists via A2A. Synthesizes final RCA.
- **Tools**: All 10 ES|QL tools + workflow tools
- **Behavior**:
  1. Get service health overview
  2. Classify incident type
  3. Dispatch specialist agents
  4. Collect findings
  5. Synthesize root cause
  6. Execute remediation
  7. Generate incident report

### Log Analyzer (Specialist)
- **ID**: `incident-cortex-log-analyzer`
- **Color**: `#4ECDC4` (teal), Symbol: `LA`
- **Role**: Deep log analysis -- error patterns, traces, first occurrences
- **Tools**: `ic-find-error-spike`, `ic-correlate-trace`, `ic-find-first-occurrence`, `platform.core.search`

### Metrics Analyzer (Specialist)
- **ID**: `incident-cortex-metrics`
- **Color**: `#45B7D1` (blue), Symbol: `MA`
- **Role**: Infrastructure metrics -- CPU/memory/latency anomalies, deployment correlation
- **Tools**: `ic-detect-metric-anomaly`, `ic-correlate-deploy-metric`, `ic-get-deployments`, `ic-service-health-overview`

### Security Analyst (Specialist)
- **ID**: `incident-cortex-security`
- **Color**: `#F7DC6F` (yellow), Symbol: `SA`
- **Role**: Security threat analysis -- brute-force, suspicious IPs, threat intelligence
- **Tools**: `ic-check-security-alerts`, `ic-investigate-ip`, `ic-search-similar-incidents`, `platform.core.search`

## ES|QL Custom Tools (10)

All tools use parameterized queries (no string interpolation). Created via `POST /api/agent_builder/tools` with `type: "esql"`.

| # | Tool ID | Purpose | Key ES\|QL Features |
|---|---------|---------|---------------------|
| 1 | `ic-find-error-spike` | Detect error rate spikes by service | STATS, BUCKET, COUNT_DISTINCT |
| 2 | `ic-correlate-trace` | Follow distributed trace across services | WHERE trace.id, SORT |
| 3 | `ic-find-first-occurrence` | Pinpoint when error first appeared | WHERE + SORT + LIMIT |
| 4 | `ic-detect-metric-anomaly` | Find CPU/memory/latency anomalies per host | AVG, MAX, BUCKET |
| 5 | `ic-correlate-deploy-metric` | Correlate deployments with metric changes | STATS BY host + time bucket |
| 6 | `ic-check-security-alerts` | Query security alerts by time/severity | COUNT_DISTINCT(source.ip) |
| 7 | `ic-investigate-ip` | Investigate suspicious IP activity | COUNT by time bucket |
| 8 | `ic-get-deployments` | List recent deployments for a service | WHERE + SORT DESC |
| 9 | `ic-search-similar-incidents` | Find past incidents with similar patterns | WHERE status resolved |
| 10 | `ic-service-health-overview` | System-wide health snapshot | AVG, SUM BY service |

## Elastic Workflows (5)

Workflows created in Kibana via YAML definitions with Liquid templating. For hackathon, external actions (Slack, Jira) are simulated by indexing to `incident-cortex-notifications`.

| Workflow | Trigger | Action |
|----------|---------|--------|
| `notify-slack` | Agent tool call | Index notification doc (simulates Slack webhook) |
| `create-jira-ticket` | Agent tool call | Index ticket doc (simulates Jira API) |
| `rollback-deployment` | Agent tool call | Index rollback action (simulates deployment API) |
| `block-ip` | Agent tool call | Index IP block action (simulates firewall API) |
| `index-incident-report` | Agent tool call | Write structured incident report to `incidents-incident-cortex` |

## MCP Server

Native Elastic MCP server at `${KIBANA_URL}/api/agent_builder/mcp`. Exposes all Agent Builder tools to external clients (Claude Desktop, Cursor, VS Code).

- Requires API key with `feature_agentBuilder.read` Kibana privilege
- Claude Desktop config uses `npx mcp-remote` to bridge HTTP to stdio
- All 10 custom ES|QL tools available as MCP tools

## Chat UI

### Technology: Next.js + React + Tailwind CSS

### API Integration
- Proxy route: `POST /api/chat` -> `POST ${KIBANA_URL}/api/agent_builder/converse`
- Async streaming: `POST /api/agent_builder/converse/async` for real-time updates
- Conversation persistence via `conversation_id`

### Components
- `ChatMessage` -- Message bubble with agent identity (name, color, avatar)
- `QueryDetails` -- Collapsible panel showing ES|QL queries per finding
- `AgentStatus` -- Shows which agent is currently investigating
- `RemediationPanel` -- Proposed remediation actions with approve/override buttons
- `IncidentTimeline` -- Visual timeline of investigation events

### Design: Dark theme, monospace code fonts, SRE dashboard aesthetic. Green/red/yellow status colors.

## Fallback Strategy

| Failure | Fallback | Impact |
|---------|----------|--------|
| A2A protocol 404 | Single Triage agent with all 10 tools | Lose multi-agent wow, keep investigation depth |
| Workflows unavailable | Simulate by indexing actions to ES | Same UX, just stored differently |
| Chat UI incomplete | Use Kibana built-in chat for demo | Judge confirmed both acceptable |
| MCP connection fails | Skip MCP demo section | Bonus feature, not core |

## API Reference

### Agent Builder Endpoints (Kibana)
- `GET/POST/PUT/DELETE /api/agent_builder/agents` -- Agent CRUD
- `GET/POST/PUT/DELETE /api/agent_builder/tools` -- Tool CRUD
- `POST /api/agent_builder/converse` -- Synchronous chat
- `POST /api/agent_builder/converse/async` -- Streaming chat
- `GET /api/agent_builder/a2a/{agentId}` -- A2A agent card
- `GET /api/agent_builder/mcp` -- MCP server endpoint

### Required Headers
- `Authorization: ApiKey <key>`
- `kbn-xsrf: true` (for POST/PUT/DELETE)
- `Content-Type: application/json`

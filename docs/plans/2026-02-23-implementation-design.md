# Incident Cortex — Implementation Design

## 1. Overview

Multi-agent SRE & Security autopilot built on Elastic Agent Builder. Investigates incidents across logs, metrics, and security signals using 10 custom ES|QL tools, 4 coordinated AI agents, and 5 Elastic Workflows for automated remediation. Exposed externally via MCP for Claude Desktop integration. Presented through a command-center chat UI built with Next.js.

This document is the single source of truth for implementation. It covers architecture, data model, tools, agents, workflows, UI, testing, and the phase-by-phase build order.

---

## 2. Architecture

```
                       ┌─────────────────────────────────┐
                       │       COMMAND CENTER UI          │
                       │  (Next.js + React + Tailwind)    │
                       │                                  │
                       │  ┌────────┬──────────┬────────┐  │
                       │  │ Agents │   Chat   │Details │  │
                       │  │ Panel  │  Panel   │ Panel  │  │
                       │  └────────┴──────────┴────────┘  │
                       └──────────────┬──────────────────┘
                                      │ POST /api/chat
                                      ▼
                       ┌──────────────────────────────────┐
                       │       Next.js API Route           │
                       │   (proxies to Kibana)             │
                       └──────────────┬───────────────────┘
                                      │ POST /api/agent_builder/converse
                                      ▼
           ┌──────────────────────────────────────────────────┐
           │              ELASTIC AGENT BUILDER                │
           │                                                   │
           │   ┌─────────────────────────────────────────┐     │
           │   │          TRIAGE AGENT (Coordinator)      │     │
           │   │  • Classifies: OPERATIONAL / SECURITY    │     │
           │   │  • Dispatches specialists via A2A        │     │
           │   │  • Synthesizes root cause analysis       │     │
           │   │  • Executes remediation workflows        │     │
           │   └────────┬──────────┬──────────┬──────────┘     │
           │            │  A2A     │  A2A     │  A2A           │
           │   ┌────────▼───┐ ┌───▼────┐ ┌───▼──────────┐     │
           │   │ LOG        │ │ METRIC │ │ SECURITY     │     │
           │   │ ANALYZER   │ │ AGENT  │ │ ANALYST      │     │
           │   │            │ │        │ │              │     │
           │   │ Tools:     │ │ Tools: │ │ Tools:       │     │
           │   │ • error    │ │ • cpu  │ │ • alerts     │     │
           │   │ • trace    │ │ • dep  │ │ • ip invest  │     │
           │   │ • first    │ │ • hist │ │ • similar    │     │
           │   └────────────┘ └────────┘ └──────────────┘     │
           │                                                   │
           │   ┌──────────────────────────────────────────┐    │
           │   │        10 ES|QL CUSTOM TOOLS              │    │
           │   │   (parameterized queries against ES)      │    │
           │   └──────────────────┬───────────────────────┘    │
           │                      │                            │
           │   ┌──────────────────▼───────────────────────┐    │
           │   │        5 ELASTIC WORKFLOWS                │    │
           │   │  notify-slack │ jira │ rollback │ block   │    │
           │   │  index-report                             │    │
           │   └──────────────────────────────────────────┘    │
           └──────────────────────┬────────────────────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────────┐
           │           ELASTICSEARCH SERVERLESS                │
           │                                                   │
           │  logs-incident-cortex          (~10K docs)        │
           │  metrics-incident-cortex       (~14K docs)        │
           │  security-alerts-incident-cortex (~250 docs)      │
           │  deployments-incident-cortex   (20 docs)          │
           │  threat-intel-incident-cortex  (50 docs)          │
           │  incidents-incident-cortex     (written by agent) │
           │  incident-cortex-notifications (written by wkfl)  │
           └──────────────────────────────────────────────────┘

           ┌──────────────────────────────────────────────────┐
           │           MCP SERVER (External Access)            │
           │  ${KIBANA_URL}/api/agent_builder/mcp              │
           │  Exposes all 10 tools to Claude Desktop / IDEs    │
           └──────────────────────────────────────────────────┘
```

### Fallback Strategy

| Failure | Fallback | Impact |
|---------|----------|--------|
| A2A protocol 404 | Single Triage agent with all 10 tools | Lose multi-agent wow, keep investigation depth |
| Workflows unavailable | Simulate by indexing action docs to ES | Same UX, just stored differently |
| Chat UI incomplete | Use Kibana built-in chat for demo | Both acceptable per hackathon judges |
| MCP connection fails | Skip MCP demo section | Bonus feature, not core |

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Agents | Elastic Agent Builder (Kibana API) | LLM-powered investigation agents |
| Agent Coordination | A2A Protocol (Google) | Multi-agent message passing |
| Data Queries | ES\|QL (parameterized) | Custom investigation tools |
| Remediation | Elastic Workflows (YAML + Liquid) | Automated response actions |
| External Access | Native Elastic MCP Server | IDE / Claude Desktop integration |
| Storage | Elasticsearch Serverless | All data storage and retrieval |
| Embeddings | semantic_text + ELSER | Threat intelligence semantic search |
| Frontend | Next.js 15 + React 19 + Tailwind CSS 4 | Command center chat UI |
| Frontend Testing | Vitest + Testing Library + Playwright | Component tests + E2E |
| Backend Testing | pytest | API validation + integration tests |
| Data Generation | Python (Faker + elasticsearch-py) | Synthetic incident scenario |

---

## 4. Data Model

### 4.1 Elasticsearch Indices (7)

#### `logs-incident-cortex` — Application and infrastructure logs

| Field | Type | Description |
|-------|------|-------------|
| `@timestamp` | date | Event timestamp |
| `service.name` | keyword | Service that emitted the log |
| `log.level` | keyword | info, warn, error, debug |
| `message` | text | Log message body |
| `trace.id` | keyword | Distributed trace correlation ID |
| `host.name` | keyword | Host that generated the log |
| `error.type` | keyword | Exception class name (e.g. NullPointerException) |
| `error.stack_trace` | text | Full stack trace when available |

Volume: ~10,000 documents across 5 services.

#### `metrics-incident-cortex` — Infrastructure time-series metrics

| Field | Type | Description |
|-------|------|-------------|
| `@timestamp` | date | Metric collection timestamp (1-min intervals) |
| `host.name` | keyword | Host being monitored |
| `service.name` | keyword | Primary service running on host |
| `system.cpu.total.pct` | float | CPU utilization 0.0–1.0 |
| `system.memory.used.pct` | float | Memory utilization 0.0–1.0 |
| `http.response.latency_ms` | float | Average response latency in milliseconds |
| `http.response.status_code` | integer | Dominant HTTP status code |
| `http.request.count` | long | Request count in the interval |

Volume: ~14,400 documents (10 hosts × 1,440 minutes).

#### `security-alerts-incident-cortex` — SIEM alerts and security events

| Field | Type | Description |
|-------|------|-------------|
| `@timestamp` | date | Alert timestamp |
| `event.category` | keyword | authentication, intrusion_detection, network |
| `event.action` | keyword | login_attempt, port_scan, brute_force |
| `source.ip` | ip | Source IP address |
| `destination.ip` | ip | Destination IP address |
| `user.name` | keyword | Targeted user account |
| `alert.severity` | keyword | critical, high, medium, low |
| `alert.rule_name` | keyword | Rule that triggered the alert |
| `message` | text | Alert description |

Volume: ~250 events including brute-force pattern from 203.0.113.42.

#### `deployments-incident-cortex` — Deployment history

| Field | Type | Description |
|-------|------|-------------|
| `@timestamp` | date | Deployment timestamp |
| `deployment.version` | keyword | Semantic version (e.g. v2.4.1) |
| `deployment.service` | keyword | Service being deployed |
| `deployment.author` | keyword | Who triggered the deployment |
| `deployment.status` | keyword | success, failed, rolling_back |
| `deployment.commit_sha` | keyword | Git commit SHA |
| `deployment.changes` | text | Changelog / release notes |

Volume: 20 deployment records across all services.

#### `threat-intel-incident-cortex` — Threat intelligence database

| Field | Type | Description |
|-------|------|-------------|
| `indicator.ip` | ip | Known malicious IP address |
| `indicator.type` | keyword | ip, domain, hash, url |
| `threat.description` | semantic_text | Natural language description (ELSER embeddings) |
| `threat.severity` | keyword | critical, high, medium, low |
| `threat.actor` | keyword | Attributed threat group |
| `cve.id` | keyword | CVE identifier if applicable |
| `last_seen` | date | Last observed activity |

Volume: 50 entries with ELSER embeddings for semantic search.

#### `incidents-incident-cortex` — Generated incident reports (written by agent)

| Field | Type | Description |
|-------|------|-------------|
| `@timestamp` | date | Report creation time |
| `incident.id` | keyword | Unique incident identifier |
| `incident.severity` | keyword | P1–P4 |
| `incident.status` | keyword | investigating, mitigated, resolved |
| `incident.title` | text | One-line incident summary |
| `incident.root_cause` | text | Root cause analysis narrative |
| `incident.remediation` | text | Actions taken |
| `incident.agents_involved` | keyword | Which agents contributed (array) |
| `incident.timeline` | nested | Ordered list of investigation events |

#### `incident-cortex-notifications` — Simulated external actions (written by workflows)

| Field | Type | Description |
|-------|------|-------------|
| `@timestamp` | date | Notification timestamp |
| `channel` | keyword | Target channel (e.g. #incidents) |
| `severity` | keyword | Severity level |
| `message` | text | Notification body |
| `type` | keyword | slack_notification, jira_ticket, rollback_action, ip_block |

### 4.2 Synthetic Incident Scenario

All data is synthetic (hackathon rule — no real PII). One coherent scenario with interconnected signals designed to demonstrate multi-signal root cause analysis.

**Services**: payment-service, user-service, api-gateway, notification-service, inventory-service
**Hosts**: node-1 through node-10 (each service has a primary + secondary host)
**Baseline**: 24 hours of normal operational data
**Incident window** (14:25–14:45 UTC):

| Time | Event | Index | Signal |
|------|-------|-------|--------|
| 14:25 | Brute-force login attempts from 203.0.113.42 begin | security-alerts | Authentication failures spike |
| 14:28 | Deployment v2.4.1 of payment-service by deploy-bot | deployments | New version rolled out |
| 14:30 | payment-service throws NullPointerException on node-3, node-7 | logs | Error spike in application logs |
| 14:30 | CPU spike on node-3 to 92% | metrics | Infrastructure anomaly |
| 14:32 | Latency propagation to api-gateway (p99 > 2000ms) | metrics | Cascading performance degradation |
| 14:35 | Error rate exceeds threshold, automated alerts fire | logs + metrics | Cross-signal alert convergence |

**Root cause**: Deployment v2.4.1 introduced a null pointer bug in payment-service's checkout handler. The bug causes CPU thrashing on affected nodes (node-3, node-7), which cascades latency to api-gateway. The brute-force attack is a separate concurrent security incident unrelated to the operational failure.

---

## 5. ES|QL Custom Tools (10)

All tools use parameterized queries (never string interpolation). Created via `POST /api/agent_builder/tools` with `type: "esql"`. Each tool has a descriptive `description` field that guides the LLM on when and how to use it.

### 5.1 Tool Inventory

| # | ID | Domain | Purpose | Key ES\|QL Features |
|---|-----|--------|---------|---------------------|
| 1 | `ic-find-error-spike` | Logs | Detect error rate spikes by service and time | STATS, BUCKET, COUNT_DISTINCT |
| 2 | `ic-correlate-trace` | Logs/Traces | Follow distributed trace across services | WHERE trace.id, SORT |
| 3 | `ic-find-first-occurrence` | Logs | Pinpoint when an error first appeared | WHERE + SORT + LIMIT |
| 4 | `ic-detect-metric-anomaly` | Metrics | Find CPU/memory/latency anomalies per host | AVG, MAX, BUCKET |
| 5 | `ic-correlate-deploy-metric` | Metrics/Deploys | Correlate deployments with metric changes | STATS BY host + time bucket |
| 6 | `ic-check-security-alerts` | Security | Query security alerts by time range | COUNT_DISTINCT(source.ip) |
| 7 | `ic-investigate-ip` | Security | Investigate suspicious IP activity patterns | COUNT by time bucket |
| 8 | `ic-get-deployments` | Deployments | List recent deployments for a service | WHERE + SORT DESC |
| 9 | `ic-search-similar-incidents` | Incidents | Find past incidents with similar patterns | WHERE status resolved |
| 10 | `ic-service-health-overview` | Overview | System-wide health snapshot | AVG, SUM BY service |

### 5.2 Tool Definitions

Full JSON definitions are in `docs/plans/2026-02-23-incident-cortex-implementation.md` Task 3. Each tool follows this structure:

```json
{
  "id": "ic-<name>",
  "type": "esql",
  "description": "<When to use this tool and what it returns>",
  "tags": ["incident-cortex", "<domain>"],
  "configuration": {
    "query": "<parameterized ES|QL query>",
    "params": {
      "<paramName>": {
        "type": "<date|string>",
        "description": "<What this parameter means>"
      }
    }
  }
}
```

### 5.3 Tool Description Guidelines

Tool descriptions are the primary mechanism for the LLM to select the right tool. Each description must:
- State **when** to use the tool (trigger condition)
- State **what** it returns (output shape)
- Be specific enough that the LLM doesn't confuse similar tools

Example (good): "Detect error rate spikes in application logs. Use this when investigating service errors or outages. Returns error counts bucketed by minute for the specified service and time range."

Example (bad): "Search logs for errors."

---

## 6. Elastic Workflows (5)

Workflows provide automated remediation actions. For the hackathon, all external integrations (Slack, Jira, deployment APIs, firewalls) are simulated by indexing documents to Elasticsearch. This satisfies the "no real infrastructure" constraint while demonstrating the workflow pattern.

### 6.1 Workflow Inventory

| Workflow | Trigger | Simulated Action | Target Index |
|----------|---------|------------------|--------------|
| `notify-slack` | Agent tool call | Slack webhook POST | incident-cortex-notifications |
| `create-jira-ticket` | Agent tool call | Jira REST API POST | incident-cortex-notifications |
| `rollback-deployment` | Agent tool call | Deployment API call | incident-cortex-notifications |
| `block-ip` | Agent tool call | Firewall rule addition | incident-cortex-notifications |
| `index-incident-report` | Agent tool call | Structured report storage | incidents-incident-cortex |

### 6.2 Workflow Definitions

Each workflow uses Elastic Workflow YAML with Liquid templating. Workflows are created in Kibana under Stack Management > Workflows, then wrapped as workflow-type tools for agent invocation.

Core pattern (all 5 follow this):
```yaml
name: <workflow-name>
description: <what it does>
inputs:
  - id: <param>
    type: string
    description: <what it means>
steps:
  - id: <step-id>
    action: core/elasticsearch/index_document
    params:
      index: <target-index>
      document:
        "@timestamp": "{{ now }}"
        type: <action-type>
        <fields from inputs>
```

Full YAML definitions are in `docs/plans/2026-02-23-incident-cortex-implementation.md` Task 4.

---

## 7. Agent Design (4 Agents)

### 7.1 Agent Inventory

| Agent | ID | Color | Symbol | Role | Tools |
|-------|----|-------|--------|------|-------|
| Triage | `incident-cortex-triage` | #FF6B6B (red) | TR | Coordinator: classify, dispatch, synthesize RCA, remediate | All 10 + workflows |
| Log Analyzer | `incident-cortex-log-analyzer` | #4ECDC4 (teal) | LA | Deep log analysis: errors, traces, first occurrences | 3 log tools + search |
| Metrics Analyzer | `incident-cortex-metrics` | #45B7D1 (blue) | MA | Infrastructure: CPU/mem/latency anomalies, deploy correlation | 4 metric tools |
| Security Analyst | `incident-cortex-security` | #F7DC6F (yellow) | SA | Threats: brute-force, suspicious IPs, threat intel | 3 security tools + search |

### 7.2 Triage Agent Behavior

The Triage agent is the entry point for all investigations. Its system prompt enforces this sequence:

1. **Assess** — Get service health overview to understand current system state
2. **Classify** — Determine incident type: OPERATIONAL, SECURITY, or BOTH
3. **Dispatch** — Send investigation requests to specialist agents via A2A
4. **Collect** — Gather findings from each specialist
5. **Correlate** — Identify root cause by cross-referencing findings across domains
6. **Remediate** — Execute workflow tools (notify, rollback, block, report)
7. **Report** — Generate and index structured incident report

### 7.3 Specialist Agent Behavior

Each specialist follows its domain-specific investigation pattern:

**Log Analyzer**: error spike → trace correlation → first occurrence → timeline
**Metrics Analyzer**: metric anomaly detection → deployment correlation → deployment history → impact scope
**Security Analyst**: alert overview → IP investigation → threat intel cross-reference → severity classification

### 7.4 A2A Protocol Integration

Agents communicate via the A2A (Agent-to-Agent) protocol. Each agent publishes an Agent Card at `/api/agent_builder/a2a/{agentId}.json` describing its capabilities. The Triage agent's system prompt references specialists as A2A collaborators.

If A2A is unstable (known issue in some Serverless deployments), the Triage agent degrades to a single-agent configuration with all 10 tools assigned directly. The investigation quality remains identical; only the multi-agent orchestration is lost.

Full agent JSON definitions are in `docs/plans/2026-02-23-incident-cortex-implementation.md` Task 5.

---

## 8. MCP Server

The native Elastic MCP server at `${KIBANA_URL}/api/agent_builder/mcp` exposes all Agent Builder tools to external clients. This enables Claude Desktop, Cursor, VS Code, and other MCP-compatible tools to query incident data directly.

### 8.1 Configuration

```json
{
  "mcpServers": {
    "incident-cortex": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${KIBANA_URL}/api/agent_builder/mcp",
        "--header",
        "Authorization:ApiKey ${MCP_API_KEY}"
      ]
    }
  }
}
```

### 8.2 API Key Requirements

The MCP API key requires:
- Cluster privilege: `monitor_inference`
- Index privileges: read/write on `*incident-cortex*`
- Kibana privilege: `feature_agentBuilder.read` on `space:default`

---

## 9. Chat UI — Command Center

### 9.1 Layout

Three-panel command center layout optimized for incident investigation.

```
┌─────────────────────────────────────────────────────────────────┐
│  ◉ Incident Cortex                              Command Center  │
├────────────┬─────────────────────────────┬──────────────────────┤
│            │                             │                      │
│  AGENTS    │         CHAT                │     DETAILS          │
│            │                             │                      │
│  ┌──────┐  │  ┌───────────────────────┐  │  ┌────────────────┐  │
│  │ TR   │  │  │ [User]                │  │  │ INCIDENT       │  │
│  │Active│  │  │ Investigate payment-  │  │  │ TIMELINE       │  │
│  └──────┘  │  │ service 500 errors    │  │  │                │  │
│            │  └───────────────────────┘  │  │  14:25 ● BF    │  │
│  ┌──────┐  │                             │  │  14:28 ● Deploy│  │
│  │ LA   │  │  ┌───────────────────────┐  │  │  14:30 ● Error │  │
│  │Invest│  │  │ [Triage]              │  │  │  14:30 ● CPU ▲ │  │
│  └──────┘  │  │ Classifying incident  │  │  │  14:32 ● Lat ▲ │  │
│            │  │ as BOTH: operational  │  │  │                │  │
│  ┌──────┐  │  │ + security...         │  │  └────────────────┘  │
│  │ MA   │  │  └───────────────────────┘  │                      │
│  │Wait  │  │                             │  ┌────────────────┐  │
│  └──────┘  │  ┌───────────────────────┐  │  │ ES|QL QUERY    │  │
│            │  │ [Log Analyzer]        │  │  │                │  │
│  ┌──────┐  │  │ Found error spike:    │  │  │ FROM logs-     │  │
│  │ SA   │  │  │ 847 errors in 15min   │  │  │ incident-cortex│  │
│  │Wait  │  │  │                       │  │  │ | WHERE ...    │  │
│  └──────┘  │  │ ▶ Show ES|QL Query    │  │  │ | STATS ...    │  │
│            │  └───────────────────────┘  │  │                │  │
│  ──────── │                             │  └────────────────┘  │
│            │  ┌───────────────────────┐  │                      │
│  WORKFLOWS │  │ [Triage]              │  │  ┌────────────────┐  │
│            │  │ Recommended actions:  │  │  │ FINDINGS       │  │
│  ✅ Slack  │  │                       │  │  │                │  │
│  ⏳ Jira   │  │ ☑ Rollback v2.4.1    │  │  │ • Error spike  │  │
│  ○ Rollbk  │  │ ☑ Block 203.0.113.42 │  │  │ • CPU anomaly  │  │
│  ○ Block   │  │ ☑ Notify #incidents  │  │  │ • Deploy v2.4.1│  │
│            │  │                       │  │  │ • BF attack    │  │
│            │  │ [Approve] [Override]  │  │  │                │  │
│            │  └───────────────────────┘  │  └────────────────┘  │
│            │                             │                      │
├────────────┼─────────────────────────────┼──────────────────────┤
│            │  ┌─────────────────────┐ ▶  │                      │
│            │  │ Type a message...   │    │                      │
└────────────┴─────────────────────────────┴──────────────────────┘
```

### 9.2 Panel Specifications

#### Left Panel — Agent & Workflow Status (240px fixed width)

**Agent Cards**:
- Each agent displayed as a compact card with avatar (colored circle + 2-letter symbol)
- Status states: `idle` (gray), `active` (pulsing border), `investigating` (animated), `complete` (check), `error` (red)
- Real-time status updates as the Triage agent dispatches work

**Workflow Tracker**:
- Separator line below agents
- Each workflow shown as a single row: icon + name + status
- Status states: `○ pending`, `⏳ running`, `✅ complete`, `❌ failed`
- Updates in real-time as remediation workflows execute

#### Center Panel — Chat (flex, fills remaining width)

**Message Bubbles**:
- User messages: right-aligned, subtle background
- Agent messages: left-aligned with agent identity badge (colored dot + name)
- Each agent has its own color matching the left panel cards
- Markdown rendering for formatted responses (headers, lists, bold, code)
- Inline code blocks for ES|QL snippets within responses

**Remediation Cards**:
- Rendered inline in the chat when the agent proposes actions
- Each action is a checkbox row: `☑ Action description`
- Two buttons at bottom: `[Approve All]` `[Override]`
- Approve sends confirmation back to agent, Override opens a text input

**Loading States**:
- Typing indicator (three dots) with agent name: "Triage is thinking..."
- Shimmer placeholder for long responses

**Input Bar**:
- Text input spanning full width of center panel
- Send button (arrow icon) on right
- Keyboard shortcut: Enter to send, Shift+Enter for newline
- Disabled state while agent is responding

#### Right Panel — Context-Sensitive Details (320px fixed width)

The right panel content changes based on user interaction. Only one view is active at a time, with smooth crossfade transitions.

**Default View: Incident Timeline**
- Vertical timeline with timestamps on left, event descriptions on right
- Color-coded dots matching event type (red for errors, blue for metrics, yellow for security, green for deployments)
- Auto-populates as the investigation progresses
- Clickable events that switch panel to the relevant query/finding

**On Finding Click: ES|QL Query View**
- Full ES|QL query in a syntax-highlighted code block (Source Code Pro font)
- Copy-to-clipboard button
- Raw query results below (scrollable table)
- "Back to timeline" link at top

**On Remediation Click: Workflow Status View**
- Workflow name, description, current status
- Input parameters that were passed
- If complete: link to the indexed document in Elasticsearch
- Execution time

**On Agent Click (from left panel): Agent Detail View**
- Agent name, description, assigned tools
- Current conversation context (if active)
- System prompt summary (abbreviated)

### 9.3 Visual Design — Elastic-Branded

The UI follows Elastic's design language (EUI - Elastic UI) adapted for a dark-theme command center.

**Colors**:
| Token | Value | Usage |
|-------|-------|-------|
| Background (primary) | `#1D1E24` | Page background |
| Background (panel) | `#25262E` | Panel backgrounds |
| Background (card) | `#2C2D35` | Cards, message bubbles |
| Background (input) | `#343741` | Input fields, code blocks |
| Text (primary) | `#DFE5EF` | Main text |
| Text (secondary) | `#98A2B3` | Labels, descriptions |
| Text (subdued) | `#69707D` | Timestamps, metadata |
| Elastic Blue | `#0077CC` | Primary actions, links, focus |
| Success (teal) | `#00BFB3` | Success states, confirmed actions |
| Warning (yellow) | `#FEC514` | Warning states, security events |
| Danger (red) | `#FF6666` | Errors, critical alerts |
| Accent (purple) | `#B298DC` | Highlighted selections |

**Agent Colors** (from Agent Builder definitions):
| Agent | Color | Usage |
|-------|-------|-------|
| Triage | `#FF6B6B` | Red — coordinator, urgency |
| Log Analyzer | `#4ECDC4` | Teal — logs, data |
| Metrics Analyzer | `#45B7D1` | Blue — infrastructure |
| Security Analyst | `#F7DC6F` | Yellow — warnings, threats |

**Typography**:
| Element | Font | Size | Weight |
|---------|------|------|--------|
| UI labels, buttons | Inter | 14px | 500 |
| Chat messages | Inter | 15px | 400 |
| Agent names | Inter | 13px | 600 |
| ES\|QL code | Source Code Pro | 13px | 400 |
| Timestamps | Source Code Pro | 12px | 400 |
| Panel headers | Inter | 12px | 700 (uppercase) |

**Component Styling**:
- Rounded corners: 8px for cards, 6px for buttons, 4px for badges
- Borders: 1px solid `#343741` (subtle panel separation)
- Shadows: minimal, only on floating elements (dropdowns, modals)
- Transitions: 150ms ease for state changes, 200ms for panel content switches
- Agent avatar: 32px circle with background color + white 2-letter symbol

### 9.4 Frontend Architecture

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout, fonts, global styles
│   ├── page.tsx                # Main command center page
│   ├── globals.css             # Tailwind imports + custom tokens
│   └── api/
│       └── chat/
│           └── route.ts        # POST proxy to Kibana Agent Builder
├── components/
│   ├── panels/
│   │   ├── AgentPanel.tsx      # Left panel: agent cards + workflow status
│   │   ├── ChatPanel.tsx       # Center panel: chat messages + input
│   │   └── DetailsPanel.tsx    # Right panel: context-sensitive content
│   ├── chat/
│   │   ├── ChatMessage.tsx     # Individual message bubble with agent identity
│   │   ├── ChatInput.tsx       # Message input bar with send button
│   │   ├── RemediationCard.tsx # Inline remediation action card
│   │   └── TypingIndicator.tsx # Agent thinking animation
│   ├── details/
│   │   ├── IncidentTimeline.tsx # Vertical timeline of events
│   │   ├── QueryView.tsx       # ES|QL query + results display
│   │   ├── WorkflowStatus.tsx  # Workflow execution details
│   │   └── AgentDetail.tsx     # Agent info view
│   └── shared/
│       ├── AgentBadge.tsx      # Colored agent name badge
│       ├── StatusIndicator.tsx # Pulse/static status dots
│       └── CodeBlock.tsx       # Syntax-highlighted code display
├── lib/
│   ├── api.ts                  # API client for chat route
│   ├── types.ts                # TypeScript interfaces
│   └── constants.ts            # Agent colors, status labels
├── hooks/
│   ├── useChat.ts              # Chat state management (messages, send, loading)
│   ├── useAgentStatus.ts       # Agent status tracking from responses
│   └── useDetailsPanel.ts     # Details panel content state
├── __tests__/                  # Vitest component tests
│   ├── setup.ts
│   ├── ChatMessage.test.tsx
│   ├── ChatInput.test.tsx
│   ├── AgentPanel.test.tsx
│   ├── RemediationCard.test.tsx
│   ├── IncidentTimeline.test.tsx
│   ├── QueryView.test.tsx
│   └── api-chat.test.ts
├── e2e/                        # Playwright E2E tests
│   └── chat-flow.spec.ts
├── vitest.config.ts
└── playwright.config.ts
```

### 9.5 API Integration

The frontend communicates with Elastic Agent Builder through a Next.js API route that proxies requests. This avoids CORS issues and keeps the API key server-side.

**Request flow**:
1. User types message in ChatInput
2. `useChat` hook sends `POST /api/chat` with `{ message, agentId, conversationId }`
3. API route proxies to `POST ${KIBANA_URL}/api/agent_builder/converse`
4. Response parsed for: text content, tool calls (ES|QL queries), workflow invocations
5. Chat panel renders message with agent identity
6. Details panel updates with timeline events, queries, findings

**Response Parsing**:
The Agent Builder converse API returns structured responses that include:
- `message`: The agent's text response
- `conversation_id`: For maintaining conversation context
- Tool call information embedded in the response (ES|QL queries executed, results)

The frontend must parse these to extract:
- Agent identity (which agent is responding)
- ES|QL queries used (for the QueryView)
- Findings discovered (for the timeline and findings list)
- Remediation actions proposed (for RemediationCard)

### 9.6 State Management

No external state library. React state + custom hooks:

- `useChat()`: manages messages array, conversation ID, loading state, send function
- `useAgentStatus()`: derives agent statuses from chat messages (which agents have responded)
- `useDetailsPanel()`: tracks which detail view is active and its content

---

## 10. Testing Strategy

### 10.1 Approach: Test-After-Each-Phase

Each implementation phase ends with a **test gate** — an automated test suite that must pass before moving to the next phase. Tests are written alongside implementation, not as a separate phase.

### 10.2 Test Infrastructure

```
incident-cortex/
├── tests/                              # pytest — backend & API validation
│   ├── conftest.py                     # Shared fixtures
│   ├── test_phase1_foundation.py       # Index & data validation
│   ├── test_phase2_tools.py            # Tool creation & query validation
│   ├── test_phase3_workflows.py        # Workflow existence & execution
│   ├── test_phase4_agents.py           # Agent creation & converse API
│   ├── test_phase5_integration.py      # A2A + MCP validation
│   └── test_phase7_e2e.py             # Full demo scenario
├── pytest.ini                          # pytest configuration
├── frontend/
│   ├── __tests__/                      # Vitest — component tests
│   ├── e2e/                            # Playwright — browser E2E
│   ├── vitest.config.ts
│   └── playwright.config.ts
└── scripts/
    └── run_tests.sh                    # Unified test runner
```

### 10.3 Shared Test Fixtures (conftest.py)

```python
# tests/conftest.py
import os
import pytest
from elasticsearch import Elasticsearch
from dotenv import load_dotenv
import requests

load_dotenv()

@pytest.fixture(scope="session")
def es_client():
    """Elasticsearch client for the session."""
    return Elasticsearch(
        os.environ["ELASTICSEARCH_URL"],
        api_key=os.environ["API_KEY"]
    )

@pytest.fixture(scope="session")
def kibana_url():
    return os.environ["KIBANA_URL"]

@pytest.fixture(scope="session")
def api_key():
    return os.environ["API_KEY"]

@pytest.fixture(scope="session")
def kibana_headers(api_key):
    """Standard headers for Kibana API requests."""
    return {
        "Authorization": f"ApiKey {api_key}",
        "kbn-xsrf": "true",
        "Content-Type": "application/json"
    }

@pytest.fixture(scope="session")
def incident_window():
    """The incident time window for test queries."""
    return {
        "start": "2026-02-22T14:00:00.000Z",
        "end": "2026-02-22T15:00:00.000Z"
    }
```

### 10.4 Phase-by-Phase Test Specifications

#### Phase 1: Foundation Tests (`test_phase1_foundation.py`)

| Test | Assertion |
|------|-----------|
| `test_indices_exist` | All 7 indices exist (GET /{index}/_mapping returns 200) |
| `test_logs_mapping_fields` | logs index has @timestamp (date), service.name (keyword), log.level (keyword), message (text), trace.id (keyword), host.name (keyword), error.type (keyword) |
| `test_metrics_mapping_fields` | metrics index has system.cpu.total.pct (float), http.response.latency_ms (float), etc. |
| `test_security_mapping_fields` | security-alerts index has source.ip (ip), alert.severity (keyword), etc. |
| `test_threat_intel_semantic` | threat-intel index has threat.description with type semantic_text |
| `test_logs_count` | logs-incident-cortex has 8,000–12,000 documents |
| `test_metrics_count` | metrics-incident-cortex has 12,000–16,000 documents |
| `test_security_count` | security-alerts-incident-cortex has 200–300 documents |
| `test_deployments_count` | deployments-incident-cortex has 15–25 documents |
| `test_threat_intel_count` | threat-intel-incident-cortex has 40–60 documents |
| `test_incident_window_errors` | ES|QL query finds errors in payment-service during 14:25–14:45 |
| `test_incident_window_cpu_spike` | ES|QL query finds CPU > 80% on node-3 during incident window |
| `test_incident_window_brute_force` | ES|QL query finds events from 203.0.113.42 |
| `test_incident_window_deployment` | ES|QL query finds v2.4.1 deployment of payment-service |
| `test_five_services_present` | All 5 services appear in logs (payment-service, user-service, api-gateway, notification-service, inventory-service) |
| `test_ten_hosts_present` | All 10 hosts (node-1 through node-10) appear in metrics |

#### Phase 2: Tool Tests (`test_phase2_tools.py`)

| Test | Assertion |
|------|-----------|
| `test_all_tools_exist` | GET /api/agent_builder/tools returns all 10 ic-* tools |
| `test_tool_has_type_esql[tool_id]` | Each tool has type "esql" (parametrized across all 10) |
| `test_tool_has_description[tool_id]` | Each tool has non-empty description > 20 characters |
| `test_tool_has_params[tool_id]` | Each tool has configuration.params defined |
| `test_find_error_spike_returns_data` | ic-find-error-spike returns rows for payment-service during incident |
| `test_correlate_trace_returns_data` | ic-correlate-trace returns rows for a known trace ID from the data |
| `test_find_first_occurrence_returns_data` | ic-find-first-occurrence returns error with timestamp in incident window |
| `test_detect_metric_anomaly_returns_data` | ic-detect-metric-anomaly returns CPU spike on node-3 |
| `test_correlate_deploy_metric_returns_data` | ic-correlate-deploy-metric returns data for payment-service |
| `test_check_security_alerts_returns_data` | ic-check-security-alerts returns brute-force events |
| `test_investigate_ip_returns_data` | ic-investigate-ip returns activity for 203.0.113.42 |
| `test_get_deployments_returns_data` | ic-get-deployments returns v2.4.1 for payment-service |
| `test_search_similar_incidents_no_crash` | ic-search-similar-incidents executes without error (may return 0 rows initially) |
| `test_service_health_overview_returns_all_services` | ic-service-health-overview returns rows for all 5 services |

#### Phase 3: Workflow Tests (`test_phase3_workflows.py`)

| Test | Assertion |
|------|-----------|
| `test_workflows_exist` | All 5 workflows retrievable from Kibana |
| `test_notify_slack_executes` | Trigger notify-slack, verify doc appears in incident-cortex-notifications with type=slack_notification |
| `test_index_incident_report_executes` | Trigger index-incident-report, verify doc appears in incidents-incident-cortex |
| `test_create_jira_ticket_executes` | Trigger create-jira-ticket, verify doc in notifications with type=jira_ticket |
| `test_rollback_deployment_executes` | Trigger rollback-deployment, verify doc in notifications with type=rollback_action |
| `test_block_ip_executes` | Trigger block-ip, verify doc in notifications with type=ip_block |
| `test_workflow_tool_ids_retrievable` | Workflow tool IDs listed in agent builder tools endpoint |

#### Phase 4: Agent Tests (`test_phase4_agents.py`)

| Test | Assertion |
|------|-----------|
| `test_all_agents_exist` | GET /api/agent_builder/agents returns all 4 incident-cortex-* agents |
| `test_agent_has_instructions[agent_id]` | Each agent has non-empty instructions |
| `test_agent_has_tools[agent_id]` | Each agent has tool assignments |
| `test_triage_has_all_tools` | Triage agent has all 10 ic-* tools |
| `test_log_analyzer_tools` | Log Analyzer has ic-find-error-spike, ic-correlate-trace, ic-find-first-occurrence |
| `test_metrics_analyzer_tools` | Metrics has ic-detect-metric-anomaly, ic-correlate-deploy-metric, ic-get-deployments, ic-service-health-overview |
| `test_security_analyst_tools` | Security has ic-check-security-alerts, ic-investigate-ip, ic-search-similar-incidents |
| `test_triage_converse_responds` | POST converse with "What is the health of all services?" returns non-empty response |
| `test_triage_uses_health_tool` | Triage response to health query includes reference to service metrics |
| `test_log_analyzer_converse_responds` | Log Analyzer responds to "Find error spikes in payment-service" |
| `test_metrics_converse_responds` | Metrics Analyzer responds to "Check CPU anomalies on node-3" |
| `test_security_converse_responds` | Security Analyst responds to "Any suspicious IPs in recent alerts?" |

#### Phase 5: Integration Tests (`test_phase5_integration.py`)

| Test | Assertion |
|------|-----------|
| `test_a2a_agent_cards_accessible` | GET /api/agent_builder/a2a/{agentId}.json returns 200 for each agent OR document fallback |
| `test_mcp_endpoint_accessible` | GET /api/agent_builder/mcp returns valid MCP response |
| `test_multi_agent_investigation` | Triage agent investigation mentions findings from log, metric, and security domains |
| `test_fallback_single_agent` | If A2A unavailable, Triage with all tools still produces complete investigation |

#### Phase 6: Frontend Tests

**Vitest Component Tests** (`frontend/__tests__/`):

| Test | Assertion |
|------|-----------|
| `ChatMessage renders user message` | User message renders right-aligned |
| `ChatMessage renders agent message with badge` | Agent message shows colored badge with name |
| `ChatMessage renders markdown` | Bold, headers, lists rendered correctly |
| `ChatInput sends on Enter` | Enter key calls send handler with input value |
| `ChatInput clears after send` | Input field clears after sending |
| `AgentPanel shows all agents` | All 4 agents rendered with correct names and colors |
| `AgentPanel updates status` | Agent status changes from idle to active to complete |
| `RemediationCard renders actions` | Checkbox rows for each proposed action |
| `RemediationCard approve callback` | Clicking Approve calls handler with selected actions |
| `IncidentTimeline renders events` | Timeline events rendered in chronological order |
| `IncidentTimeline color-codes events` | Events have correct colors by type |
| `QueryView renders ES\|QL` | Code block with syntax highlighting |
| `QueryView copy button works` | Clicking copy writes to clipboard |
| `DetailsPanel switches views` | Panel transitions between timeline, query, workflow views |
| `API route proxies correctly` | POST /api/chat calls Kibana with correct headers |
| `API route handles errors` | 429 and 500 from Kibana returned as structured errors |

**Playwright E2E Tests** (`frontend/e2e/`):

| Test | Assertion |
|------|-----------|
| `chat-flow: page loads` | Command center renders with all 3 panels |
| `chat-flow: send message` | Typing message and clicking send shows user message in chat |
| `chat-flow: agent responds` | Agent response appears with badge and content |
| `chat-flow: query details` | Clicking "Show ES\|QL Query" shows query in right panel |
| `chat-flow: remediation approval` | Remediation card appears, approve button is clickable |
| `chat-flow: agent status updates` | Left panel shows agents transitioning through states |
| `chat-flow: timeline populates` | Right panel timeline adds events as investigation progresses |

#### Phase 7: End-to-End Tests (`test_phase7_e2e.py`)

| Test | Assertion |
|------|-----------|
| `test_demo_scenario_full_investigation` | Send demo prompt via converse API, response identifies error spike + CPU anomaly + deployment correlation + brute-force attack |
| `test_remediation_workflows_executed` | After investigation, at least 2 workflow docs appear in ES (notifications + incident report) |
| `test_incident_report_indexed` | incidents-incident-cortex has a new doc with root_cause, severity, remediation fields |
| `test_notification_indexed` | incident-cortex-notifications has new docs with type slack_notification |
| `test_investigation_mentions_all_signals` | Response text contains references to: NullPointerException, node-3, v2.4.1, 203.0.113.42 |
| `test_demo_scenario_repeatable` | Running the same prompt 3 times produces consistent investigation results |

### 10.5 Test Runner

```bash
#!/usr/bin/env bash
# scripts/run_tests.sh
set -e

PHASE="${1:-all}"

case "$PHASE" in
  phase1) pytest tests/test_phase1_foundation.py -v ;;
  phase2) pytest tests/test_phase2_tools.py -v ;;
  phase3) pytest tests/test_phase3_workflows.py -v ;;
  phase4) pytest tests/test_phase4_agents.py -v ;;
  phase5) pytest tests/test_phase5_integration.py -v ;;
  phase7) pytest tests/test_phase7_e2e.py -v ;;
  frontend)
    cd frontend
    npx vitest run
    npx playwright test
    ;;
  backend) pytest tests/ -v ;;
  all)
    pytest tests/ -v
    cd frontend
    npx vitest run
    npx playwright test
    ;;
  *) echo "Usage: $0 {phase1|phase2|phase3|phase4|phase5|phase7|frontend|backend|all}" ;;
esac
```

---

## 11. Implementation Phases

### Phase 1: Foundation

**Goal**: Elasticsearch indices created, synthetic data indexed, connectivity validated.

**Tasks**:
1. Create index mappings for all 7 indices (`data/index_mappings.json`)
2. Write synthetic data generation script (`scripts/generate_data.py`)
3. Generate and index data: ~10K logs, ~14K metrics, ~250 security events, 20 deployments, 50 threat intel
4. Verify incident scenario signals are discoverable

**Test gate**: `pytest tests/test_phase1_foundation.py` — all 16 tests pass

**Commit**: `feat(data): add index mappings and synthetic data generation`

---

### Phase 2: Investigation Tools

**Goal**: All 10 ES|QL custom tools created in Agent Builder and returning expected data.

**Tasks**:
1. Define all 10 tools as JSON (`tools/tool_definitions.json`)
2. Write creation script (`tools/create_tools.sh`)
3. Create tools via Kibana API
4. Validate each tool returns correct data for the incident scenario

**Test gate**: `pytest tests/test_phase2_tools.py` — all 14 tests pass

**Commit**: `feat(tools): add 10 ES|QL custom investigation tools`

---

### Phase 3: Remediation Workflows

**Goal**: All 5 Elastic Workflows created and executable.

**Tasks**:
1. Write YAML workflow definitions (`workflows/*.yml`)
2. Create workflows in Kibana
3. Create workflow-type tools for agent invocation
4. Test each workflow produces expected documents in ES

**Test gate**: `pytest tests/test_phase3_workflows.py` — all 7 tests pass

**Commit**: `feat(workflows): add 5 Elastic Workflows for remediation`

**Note**: Phase 2 and Phase 3 can be implemented in parallel.

---

### Phase 4: Agents

**Goal**: All 4 agents created with correct tool assignments and responding to investigation prompts.

**Tasks**:
1. Define 4 agents with system prompts (`agents/agent_definitions.json`)
2. Write creation script (`agents/create_agents.sh`)
3. Create agents via Kibana API
4. Test each agent individually via converse API

**Test gate**: `pytest tests/test_phase4_agents.py` — all 12 tests pass

**Depends on**: Phase 2 + Phase 3 (agents reference tools that must exist)

**Commit**: `feat(agents): add 4 investigation agents with system prompts`

---

### Phase 5: Integration (A2A + MCP)

**Goal**: Multi-agent coordination working (or fallback confirmed), MCP server accessible.

**Tasks**:
1. Verify A2A agent cards accessible
2. Test multi-agent investigation chain
3. Configure MCP server and API key
4. Test MCP from Claude Desktop
5. If A2A unstable, confirm single-agent fallback works

**Test gate**: `pytest tests/test_phase5_integration.py` — all 4 tests pass

**Depends on**: Phase 4

**Commit**: `feat(integration): add A2A multi-agent coordination and MCP server`

---

### Phase 6: Chat UI

**Goal**: Command center UI functional with all 3 panels, agent responses displayed, remediation interactive.

**Tasks**:
1. Initialize Next.js project with TypeScript + Tailwind
2. Implement 3-panel layout (AgentPanel, ChatPanel, DetailsPanel)
3. Build chat components (ChatMessage, ChatInput, RemediationCard, TypingIndicator)
4. Build detail components (IncidentTimeline, QueryView, WorkflowStatus, AgentDetail)
5. Implement API proxy route
6. Implement custom hooks (useChat, useAgentStatus, useDetailsPanel)
7. Apply Elastic-branded dark theme styling
8. Wire up context-sensitive right panel
9. Integration test with real agent responses

**Test gate**: `npx vitest run` (component tests) + `npx playwright test` (E2E) — all tests pass

**Note**: Phase 6 frontend scaffolding (task 1) can start in parallel with Phase 2–3. Full integration (task 9) requires Phase 4.

**Commit**: `feat(ui): add command center chat UI with 3-panel layout`

---

### Phase 7: End-to-End Validation

**Goal**: Full demo scenario works reliably from chat UI. Investigation identifies all 4 findings, remediation executes, incident report stored.

**Tasks**:
1. Run full demo prompt through converse API
2. Validate all 4 findings identified (error spike, CPU anomaly, deployment correlation, brute-force)
3. Validate remediation workflows execute (minimum: Slack notify + incident report)
4. Validate incident report indexed correctly
5. Run scenario 3 times to confirm repeatability
6. Fix any issues (ES|QL syntax, agent prompts, tool descriptions, UI rendering)

**Test gate**: `pytest tests/test_phase7_e2e.py` — all 6 tests pass

**Depends on**: All previous phases

**Commit**: `fix: polish investigation flow for demo reliability`

---

### Phase 8: Documentation & Submission

**Goal**: README complete, demo video recorded, submission materials ready.

**Tasks**:
1. Write comprehensive README with architecture diagram, setup instructions, screenshots
2. Record 3-minute demo video following the demo script
3. Post on social media with @elastic_devs
4. Submit on Devpost with video, repo, and description

**Commit**: `docs: add README, architecture diagram, and submission materials`

---

## 12. File Tree (Complete)

```
incident-cortex/
├── .claude/
│   └── agents/                         # Claude Code sub-agent definitions
├── .claudedoc/
│   └── incident-cortex-mvp/            # SDD docs (requirements, design, todo)
├── agents/
│   ├── agent_definitions.json          # 4 agent definitions with system prompts
│   └── create_agents.sh               # Agent creation via Kibana API
├── data/
│   └── index_mappings.json            # 7 Elasticsearch index mappings
├── docs/
│   ├── plans/                          # Design docs and implementation plans
│   └── research/                       # Hackathon research and API docs
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Command center page
│   │   ├── globals.css
│   │   └── api/chat/route.ts          # Kibana proxy
│   ├── components/
│   │   ├── panels/                    # AgentPanel, ChatPanel, DetailsPanel
│   │   ├── chat/                      # ChatMessage, ChatInput, RemediationCard
│   │   ├── details/                   # Timeline, QueryView, WorkflowStatus
│   │   └── shared/                    # AgentBadge, StatusIndicator, CodeBlock
│   ├── hooks/                         # useChat, useAgentStatus, useDetailsPanel
│   ├── lib/                           # api.ts, types.ts, constants.ts
│   ├── __tests__/                     # Vitest component tests
│   ├── e2e/                           # Playwright E2E tests
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   └── package.json
├── mcp/
│   ├── claude_desktop_config.json     # MCP configuration
│   └── setup_mcp.md                   # Setup instructions
├── scripts/
│   ├── setup.sh                       # Connectivity validation
│   ├── generate_data.py               # Synthetic data generation
│   ├── requirements.txt               # Python dependencies
│   └── run_tests.sh                   # Unified test runner
├── tests/
│   ├── conftest.py                    # Shared pytest fixtures
│   ├── test_phase1_foundation.py
│   ├── test_phase2_tools.py
│   ├── test_phase3_workflows.py
│   ├── test_phase4_agents.py
│   ├── test_phase5_integration.py
│   └── test_phase7_e2e.py
├── tools/
│   ├── tool_definitions.json          # 10 ES|QL tool definitions
│   └── create_tools.sh               # Tool creation via Kibana API
├── workflows/
│   ├── notify-slack.yml
│   ├── create-jira-ticket.yml
│   ├── rollback-deployment.yml
│   ├── block-ip.yml
│   └── index-incident-report.yml
├── .env                               # Environment variables (gitignored)
├── .env.example                       # Environment template
├── .gitignore
├── CLAUDE.md                          # Claude Code project instructions
├── LICENSE                            # MIT
├── pytest.ini                         # pytest configuration
└── README.md
```

---

## 13. Demo Script (3 minutes)

### [0:00–0:30] The Problem

Open command center UI. Narrate: "It's 2:30 PM and our SRE team just got paged. payment-service is returning 500 errors, latency is spiking, and there are suspicious login attempts. Normally this takes 15-60 minutes of manual investigation across multiple dashboards."

Type the demo prompt:
> "ALERT: payment-service returning 500 errors. Multiple alerts firing: error_rate_high, latency_spike, suspicious_login_attempts. Investigate and remediate."

### [0:30–1:30] The Investigation

Show the Triage agent activating in the left panel. Narrate each step:

1. **Service Health** — Triage gets an overview, identifies payment-service as the problem
2. **Log Analysis** — Log Analyzer finds error spike: NullPointerException, 847 errors in 15 minutes
3. **Metrics** — Metrics Analyzer finds CPU spike on node-3, correlates with deployment v2.4.1
4. **Security** — Security Analyst finds brute-force attack from 203.0.113.42

Show: ES|QL queries visible in the right panel. Agent status cards updating in the left panel. Timeline populating in real-time.

### [1:30–2:15] The Remediation

Triage synthesizes the root cause: "Deployment v2.4.1 introduced a null pointer bug. The brute-force attack is a separate concurrent incident."

Show remediation card with proposed actions. Click "Approve All":
- Rollback v2.4.1
- Block 203.0.113.42
- Notify #incidents Slack channel
- Create Jira ticket

Show workflow tracker updating in the left panel.

### [2:15–2:45] The Report + MCP

Show the incident report generated in the chat. Open Claude Desktop, demonstrate querying incident data via MCP: "What was the root cause of the last incident?"

### [2:45–3:00] The Impact

"50 alerts. 1 root cause. 0 minutes of manual investigation. Automated from detection to remediation in under 2 minutes."

---

## 14. Success Criteria

- [ ] All 7 Elasticsearch indices created with correct mappings and populated with synthetic data
- [ ] All 10 ES|QL custom tools created, each returning expected data for the incident scenario
- [ ] All 5 Elastic Workflows created and executable
- [ ] All 4 agents created with correct tool assignments and responding to investigation prompts
- [ ] A2A multi-agent coordination working OR single-agent fallback confirmed
- [ ] MCP server accessible from Claude Desktop with all custom tools
- [ ] Command center chat UI renders with 3-panel layout, agent responses, ES|QL queries, remediation
- [ ] Full demo scenario identifies all 4 findings and executes at least 2 remediation workflows
- [ ] All pytest tests pass (foundation, tools, workflows, agents, integration, E2E)
- [ ] All Vitest component tests pass
- [ ] All Playwright E2E tests pass
- [ ] 3-minute demo video recorded
- [ ] README with architecture diagram and setup instructions
- [ ] Public repo with MIT license
- [ ] Social media post and Devpost submission

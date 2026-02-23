# Incident Cortex

> Multi-agent SRE & Security autopilot powered by Elastic Agent Builder

Incident Cortex is an automated incident response system that coordinates 4 AI agents to investigate incidents across application logs, infrastructure metrics, and security signals — then recommends and executes remediation actions.

## Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │          Command Center (Next.js)           │
                    │  ┌──────────┬──────────────┬──────────────┐ │
                    │  │  Agent   │    Chat      │   Details    │ │
                    │  │  Panel   │    Panel     │   Panel      │ │
                    │  └──────────┴──────────────┴──────────────┘ │
                    └─────────────────┬───────────────────────────┘
                                      │ /api/chat
                    ┌─────────────────▼───────────────────────────┐
                    │        Elastic Agent Builder (Kibana)        │
                    │                                              │
                    │  ┌────────────────────────────────────────┐  │
                    │  │          Triage Agent (TR)              │  │
                    │  │     Coordinator · All 10 Tools          │  │
                    │  └─────┬──────────┬──────────┬────────────┘  │
                    │        │          │          │               │
                    │  ┌─────▼──┐ ┌─────▼──┐ ┌────▼───┐          │
                    │  │Log (LA)│ │Met (MA)│ │Sec (SA)│          │
                    │  │3 tools │ │4 tools │ │3 tools │          │
                    │  └────────┘ └────────┘ └────────┘          │
                    │                                              │
                    │  ┌────────────────────────────────────────┐  │
                    │  │     10 ES|QL Custom Tools               │  │
                    │  │  Parameterized queries with guardrails  │  │
                    │  └─────────────────┬──────────────────────┘  │
                    └─────────────────────┼────────────────────────┘
                                          │
                    ┌─────────────────────▼────────────────────────┐
                    │         Elasticsearch Serverless              │
                    │                                               │
                    │  ic-logs · ic-metrics · ic-security-alerts    │
                    │  ic-deployments · ic-threat-intel             │
                    │  ic-incidents · ic-notifications              │
                    └───────────────────────────────────────────────┘
```

## Features

### 10 ES|QL Investigation Tools
| Tool | Purpose |
|------|---------|
| `ic-service-health-overview` | Health overview of all services |
| `ic-find-error-spike` | Detect error rate spikes in logs |
| `ic-correlate-trace` | Follow distributed traces across services |
| `ic-find-first-occurrence` | Find when errors first appeared |
| `ic-detect-metric-anomaly` | Detect CPU/memory/latency anomalies |
| `ic-correlate-deploy-metric` | Correlate deployments with metric changes |
| `ic-get-deployments` | List recent deployments |
| `ic-check-security-alerts` | Query security alerts by time range |
| `ic-investigate-ip` | Investigate suspicious IP addresses |
| `ic-search-similar-incidents` | Search past incidents for patterns |

### 4 Coordinated Agents
- **Triage (TR)** — Coordinator with all 10 tools. Classifies incidents, dispatches specialists, synthesizes root cause analysis.
- **Log Analyzer (LA)** — Error patterns, distributed traces, first occurrence analysis.
- **Metrics Analyzer (MA)** — CPU/memory/latency anomalies, deployment correlation.
- **Security Analyst (SA)** — Brute-force detection, IP investigation, threat intelligence.

### Integration Protocols
- **A2A (Agent-to-Agent)** — All 4 agents expose A2A cards for inter-agent communication (protocol v0.3.0)
- **MCP Server** — All 10 tools accessible via Model Context Protocol for Claude Desktop and other MCP clients

### Synthetic Incident Scenario
A coherent 24-hour dataset with an embedded incident:
- **14:25** — Brute-force attack from 203.0.113.42
- **14:28** — Deployment v2.4.1 of payment-service
- **14:30** — Error storm: NullPointerException on payment-service (node-3, node-7)
- **14:30** — CPU spike to 85-95% on node-3
- **14:32** — Latency propagation to api-gateway (1500-3000ms)
- **14:35** — Cascading timeouts in notification-service

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Elasticsearch Serverless deployment with Agent Builder

### Setup

```bash
# Clone
git clone https://github.com/abdigaliarsen/incident-cortex.git
cd incident-cortex

# Configure
cp .env.example .env
# Edit .env with your Elasticsearch credentials

# Install Python dependencies
pip install -r scripts/requirements.txt

# Generate synthetic data & create indices
python3 scripts/generate_data.py

# Deploy 10 ES|QL tools
bash tools/create_tools.sh

# Deploy 4 agents
bash agents/create_agents.sh

# Start the UI
cd frontend
npm install
cp ../.env .env.local
npm run dev
```

Open http://localhost:3000 to access the Command Center.

### MCP Setup

See [mcp/setup_mcp.md](mcp/setup_mcp.md) for Claude Desktop integration.

## Testing

```bash
# All fast backend tests
bash scripts/run_tests.sh backend

# Individual phases
bash scripts/run_tests.sh phase1    # Indices & data
bash scripts/run_tests.sh phase2    # ES|QL tools
bash scripts/run_tests.sh phase4    # Agent existence & tools
bash scripts/run_tests.sh phase5    # A2A & MCP integration

# Slow tests (LLM converse calls)
bash scripts/run_tests.sh phase4-slow
bash scripts/run_tests.sh phase7     # Full E2E demo scenario

# Frontend
bash scripts/run_tests.sh frontend
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Data | Elasticsearch Serverless, ES|QL |
| Agents | Elastic Agent Builder (Kibana API) |
| Protocols | A2A v0.3.0, MCP 2024-11-05 |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Testing | pytest, Vitest, Playwright |
| Data Gen | Python, Faker |

## Project Structure

```
incident-cortex/
├── agents/              # Agent definitions + creation script
├── data/                # Index mappings
├── docs/                # Design docs, research, plans
├── frontend/            # Next.js command center UI
│   ├── app/             # Pages & API routes
│   ├── components/      # React components (chat, details, panels, shared)
│   ├── hooks/           # Custom hooks (useChat, useDetailsPanel)
│   └── lib/             # Types, constants, API client
├── mcp/                 # MCP server config for Claude Desktop
├── scripts/             # Data generation, test runner
├── tests/               # pytest test suites (phases 1-7)
├── tools/               # ES|QL tool definitions + creation script
└── workflows/           # Elastic Workflow YAML definitions
```

## License

MIT

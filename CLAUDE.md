# Incident Cortex

## Project Overview
Multi-agent SRE & Security autopilot for the Elasticsearch Agent Builder Hackathon. Investigates incidents across logs, metrics, and security signals, then executes automated remediation via Elastic Workflows.

## Spec Driven Development
This project uses SDD. Before writing code, always read:
1. `.claudedoc/incident-cortex-mvp/requirements.md` -- what we're building
2. `.claudedoc/incident-cortex-mvp/design.md` -- how we're building it
3. `.claudedoc/incident-cortex-mvp/todo.md` -- current task list

Sub-agents are defined in `.claude/agents/` with specialized roles.

## Tech Stack
- **Backend**: Python (data generation), Bash (setup scripts)
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Infrastructure**: Elasticsearch Serverless, Elastic Agent Builder (Kibana API)
- **Protocols**: ES|QL, A2A (agent-to-agent), MCP (model context protocol)
- **Workflows**: Elastic Workflows (YAML + Liquid templating)

## Code Standards
- Python: type hints, Black formatting, docstrings for public functions only
- TypeScript: strict mode, explicit function signature types, Prettier
- ES|QL: parameterized queries only -- never interpolate user input
- Shell: `set -e`, quote variables, shellcheck-clean
- All secrets in `.env`, never hardcoded
- Commit format: `type(scope): description` (e.g., `feat(tools): add error-spike ES|QL tool`)

## Key Architecture Decisions
- 4 agents (Triage coordinator + 3 specialists) connected via A2A protocol
- Fallback: single Triage agent with all tools if A2A is unstable
- External actions (Slack, Jira) simulated by indexing to ES (hackathon constraint)
- All data is synthetic (hackathon rule -- no real PII)

## Important Paths
- `scripts/` -- setup, data generation, testing scripts
- `tools/` -- ES|QL custom tool definitions (JSON)
- `agents/` -- Agent Builder agent definitions (JSON)
- `workflows/` -- Elastic Workflow YAML definitions
- `frontend/` -- Next.js chat UI
- `mcp/` -- MCP server configuration for Claude Desktop
- `data/` -- Index mappings and data schemas
- `docs/plans/` -- master design doc and full implementation plan (with complete JSON payloads)
- `docs/research/` -- hackathon rules, API docs, Agent Builder capabilities summary, forum discussions

## Reference Docs (read before implementation)
- `docs/plans/2026-02-23-incident-cortex-implementation.md` -- **THE implementation plan** with full JSON for all 10 tools, 4 agents, and workflow definitions. This is the primary reference for building.
- `docs/plans/2026-02-23-incident-cortex-design.md` -- master design doc with architecture, demo script, judging alignment
- `docs/research/AGENT-BUILDER-CAPABILITIES-SUMMARY.md` -- consolidated Agent Builder API capabilities
- `docs/research/kibana-api.md` -- Kibana REST API endpoints for Agent Builder
- `docs/research/rules-full.md` -- hackathon rules and judging criteria

## Hackathon Context
- **Deadline**: Feb 27, 2026 @ 1pm EST
- **Prizes**: $10K/$5K/$3K + 4x$500
- **Judging**: Technical Execution 30%, Impact & Wow Factor 30%, Demo Quality 30%, Social 10%
- **Must use**: Elastic Agent Builder on Elasticsearch Serverless
- **Key features to showcase**: ES|QL custom tools, Elastic Workflows, A2A protocol, MCP server
- **All data must be synthetic** (no real PII)
- **License**: MIT (required by hackathon)

## Environment Variables (see .env.example)
- `KIBANA_URL` -- Elastic Cloud Kibana endpoint
- `ELASTICSEARCH_URL` -- Elasticsearch endpoint
- `API_KEY` -- Elasticsearch API key with Agent Builder privileges

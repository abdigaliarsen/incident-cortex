# Incident Cortex MVP -- Requirements

## Objective
Build a multi-agent SRE & Security autopilot that investigates incidents across logs, metrics, and security signals using Elastic Agent Builder, then takes automated remediation actions via Workflows.

## User Stories

### US-1: Automated Incident Investigation
**As** an SRE on-call engineer,
**I want** an agent system that automatically investigates when alerts fire,
**So that** I don't spend 15-60 minutes manually checking logs, metrics, and dashboards.

### US-2: Cross-Signal Root Cause Analysis
**As** an SRE,
**I want** the system to correlate errors in logs with metric anomalies and deployment events,
**So that** I can identify root causes faster than manual investigation.

### US-3: Security Threat Detection
**As** a security analyst,
**I want** the system to detect and analyze security threats (brute-force, unauthorized access) alongside operational incidents,
**So that** simultaneous operational and security issues are both identified.

### US-4: Automated Remediation
**As** an SRE,
**I want** the agent to execute remediation actions (rollback deployments, block IPs, notify Slack, create Jira tickets),
**So that** common incident patterns are resolved without manual intervention.

### US-5: Interactive Investigation
**As** an SRE,
**I want** to interact with the agent through a chat UI, ask follow-up questions, and approve/override remediation actions,
**So that** I maintain control while benefiting from automation.

### US-6: External Tool Integration
**As** a developer,
**I want** the agent's tools exposed via MCP,
**So that** I can query incident data from Claude Desktop, Cursor, or other IDE integrations.

## Functional Requirements

### FR-1: Agent System
- 4 specialized agents: Triage (coordinator), Log Analyzer, Metrics Analyzer, Security Analyst
- Triage agent classifies incidents as OPERATIONAL, SECURITY, or BOTH
- Specialist agents investigate their domain and report findings
- Agents communicate via A2A protocol (with single-agent fallback)

### FR-2: ES|QL Custom Tools (10)
- `ic-find-error-spike`: Detect error rate spikes in logs by service and time range
- `ic-correlate-trace`: Follow distributed traces across services
- `ic-find-first-occurrence`: Pinpoint when an error type first appeared
- `ic-detect-metric-anomaly`: Find CPU/memory/latency anomalies per host
- `ic-correlate-deploy-metric`: Correlate deployments with metric changes
- `ic-check-security-alerts`: Query security alerts by time and severity
- `ic-investigate-ip`: Investigate suspicious IP activity patterns
- `ic-get-deployments`: List recent deployments for a service
- `ic-search-similar-incidents`: Find past incidents with similar patterns
- `ic-service-health-overview`: System-wide health snapshot

### FR-3: Elastic Workflows
- `notify-slack`: Send incident summary to Slack (simulated via ES index)
- `create-jira-ticket`: Create incident ticket (simulated via ES index)
- `rollback-deployment`: Trigger deployment rollback (simulated via ES index)
- `block-ip`: Add IP to blocklist (simulated via ES index)
- `index-incident-report`: Store structured incident report in ES

### FR-4: MCP Server
- Expose all Agent Builder tools via native Elastic MCP server
- Provide Claude Desktop configuration for external access
- API key with correct Kibana privileges

### FR-5: Chat UI
- Send messages to Triage agent via Agent Builder converse API
- Display agent responses with markdown rendering
- Show collapsible ES|QL query details per finding
- Show agent identity (name, color) for each message
- Support follow-up questions in conversation context

### FR-6: Synthetic Data
- 10K+ log entries across 5 services with realistic patterns
- 14K+ metric data points (1-min intervals, 24 hours, 10 hosts)
- 250+ security events including brute-force attack pattern
- 20 deployment records with version history
- 50 threat intelligence entries with semantic_text
- 1 coherent incident scenario with interconnected signals

## Non-Functional Requirements

### NFR-1: All data must be synthetic (hackathon rule -- no real PII or confidential data)
### NFR-2: Code must be public with OSI-approved open source license (MIT)
### NFR-3: Must run on Elasticsearch Serverless (recommended by hackathon)
### NFR-4: Demo must complete in under 3 minutes
### NFR-5: Repository must contain all source code, agent instructions, custom queries, and workflow definitions

## Edge Cases & Error Scenarios

- **E-1**: Agent Builder API returns 429 (rate limit) -- retry with backoff
- **E-2**: ES|QL query returns no results -- agent should report "no data found" not hallucinate
- **E-3**: A2A protocol returns 404 -- fall back to single Triage agent with all tools
- **E-4**: Workflow execution fails -- log failure, continue investigation, report partial results
- **E-5**: MCP connection fails -- this is a bonus feature, core demo works without it
- **E-6**: Chat UI loses connection -- show error state, allow retry
- **E-7**: Synthetic data not indexed -- setup script should verify counts after indexing

## Acceptance Criteria

- [ ] AC-1: Running the setup script creates all indices, ingests data, creates tools, creates agents
- [ ] AC-2: Typing "Investigate: payment-service alerts firing" in chat triggers full investigation
- [ ] AC-3: Investigation correctly identifies: error spike, CPU anomaly, deployment correlation, brute-force attack
- [ ] AC-4: Agent executes at least 2 remediation workflows (Slack + incident report)
- [ ] AC-5: ES|QL queries are visible in the chat UI for each finding
- [ ] AC-6: MCP server accessible from Claude Desktop with all custom tools
- [ ] AC-7: 3-minute demo video clearly shows problem -> investigation -> remediation -> impact

## Out of Scope

- Real infrastructure integration (K8s, AWS, actual Slack/Jira)
- Real-time streaming data ingestion
- User authentication in the chat UI
- Production deployment / hosting
- Mobile responsive UI
- Multi-tenant support
- Historical incident analysis beyond the demo scenario

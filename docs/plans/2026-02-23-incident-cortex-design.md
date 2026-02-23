# Incident Cortex -- Multi-Agent SRE & Security Autopilot

## Hackathon
Elasticsearch Agent Builder Hackathon (Devpost)
Deadline: Feb 27, 2026 @ 1pm EST

## Problem Statement

When a production incident occurs (service down, latency spike, error surge, security breach), SRE teams face a manual, time-consuming process:

1. Alert fires -- engineer gets paged
2. Engineer manually checks logs, metrics, traces across multiple dashboards
3. Tries to correlate signals to find root cause (15-60 minutes)
4. Decides on remediation and manually executes it
5. Writes incident report

Compounded by alert fatigue: 50 noisy alerts that stem from 1 root cause.

**Incident Cortex** is an autonomous multi-agent system that, when an alert fires, automatically investigates across all observability and security signals in parallel, identifies root cause via ES|QL correlation, executes remediation actions via Workflows, and generates a complete incident report -- in seconds, not hours.

**Measurable impact**: Reduces MTTR from ~30 min to ~2 min. Eliminates context-switching fatigue. Works 24/7.

## Architecture

### Agents (4 via A2A Protocol)

```
                    +----------------------+
                    |   Alert / Trigger    |
                    |  (ES Alert Rule or   |
                    |   Workflow cron)     |
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
              |           | |      | |             |
              | ES|QL on  | |Time- | | Threat      |
              | log index | |series| | correlation |
              | Error     | |anom- | | CVE lookup  |
              | patterns  | |aly   | | IOC match   |
              +-----+-----+ +--+---+ +------+------+
                    |          |             |
                    +----------+-------------+
                               |
                    +----------v-----------+
                    |  REMEDIATION ENGINE  |
                    |  (Elastic Workflows) |
                    |                      |
                    |  - Slack notify      |
                    |  - Restart service   |
                    |  - Create Jira ticket|
                    |  - Isolate host      |
                    |  - Scale resources   |
                    |  - Block IP (sec)    |
                    +----------+-----------+
                               |
                    +----------v-----------+
                    |  INCIDENT REPORT     |
                    |  (Indexed to ES)     |
                    |  + MCP Server        |
                    |  (Expose to Claude/  |
                    |   IDE/external)      |
                    +----------------------+
```

### Components

| Component | Tech | Purpose |
|-----------|------|---------|
| Triage Agent | Agent Builder (coordinator) | Classifies incident type (operational vs security), routes to specialist agents via A2A |
| Log Analyzer | Agent Builder + ES\|QL custom tools | Pattern match errors, correlate by trace_id, find first occurrence |
| Metrics Agent | Agent Builder + ES\|QL + LOOKUP JOIN | Detect anomalies in CPU/memory/latency, correlate with deployment events |
| Security Agent | Agent Builder + ES\|QL + semantic search | Match IOCs, check CVE databases, correlate with threat intelligence |
| Remediation | Elastic Workflows (YAML) | Execute actual actions: Slack, Jira, service restart, IP block, scale |
| MCP Server | Native Elastic MCP | Expose all tools to Claude Desktop, Cursor, VS Code for human-in-the-loop |
| Chat UI | React/Next.js frontend | Interactive SRE interface showing investigation progress, ES|QL queries, follow-up Q&A |

### Data Model (Elasticsearch Indices)

- `logs-*` -- application and infrastructure logs
- `metrics-*` -- CPU, memory, latency, error rates (time-series)
- `traces-*` -- distributed tracing / APM data
- `security-alerts-*` -- SIEM alerts, threat intelligence, IOCs
- `incidents-*` -- generated incident reports (written by the agent)
- `deployments-*` -- deployment history for correlation
- `threat-intel-*` -- CVE database, known threat actor patterns (semantic_text + ELSER)

### ES|QL Custom Tools (8-10)

1. `find_error_spike` -- detect error rate changes in logs
2. `correlate_by_trace_id` -- follow distributed trace across services
3. `find_first_occurrence` -- pinpoint when the issue started
4. `detect_metric_anomaly` -- find CPU/memory/latency spikes
5. `correlate_deploy_to_metric` -- LOOKUP JOIN deployments with metrics
6. `check_security_alerts` -- query SIEM alerts for the affected timeframe
7. `match_threat_indicators` -- semantic search against threat intel
8. `get_deployment_history` -- list recent deployments for a service
9. `search_similar_incidents` -- find past incidents with similar patterns
10. `generate_incident_report` -- aggregate findings into structured report

### Elastic Workflows

1. `notify-slack` -- Send incident summary to Slack channel
2. `create-jira-ticket` -- Create incident ticket with full RCA
3. `rollback-deployment` -- HTTP call to deployment API
4. `block-ip` -- Add IP to security blocklist
5. `scale-service` -- HTTP call to K8s/cloud scaling API
6. `index-incident-report` -- Store report in incidents-* index

### Chat UI Features

- Real-time investigation progress (agent-by-agent updates)
- Collapsible "Query Details" panel showing ES|QL queries per finding
- Follow-up question capability (SRE asks the Triage Agent)
- Approve/override remediation actions before execution
- Incident timeline visualization

## Demo Script (3 minutes)

### [0:00-0:30] The Problem
Show production scenario: payment-service returns 500 errors. Multiple alerts fire (latency, errors, suspicious logins). Show the chaos.

### [0:30-1:30] Investigation
Triage Agent activates. Chat UI shows:
- Classification: "Operational + Security incident"
- Dispatches 3 specialist agents via A2A
- Each reports with visible ES|QL queries:
  - Log Analyzer: error spike at 14:32, trace correlation
  - Metrics Agent: CPU spike on node-3, LOOKUP JOIN with deployment v2.4.1
  - Security Agent: brute-force from 203.0.113.42
- Triage synthesizes: "Regression in v2.4.1 + active brute-force attack"

### [1:30-2:15] Remediation
Agent executes Workflows:
- Rolls back deployment
- Blocks attacker IP
- Sends Slack notification
- Creates Jira ticket
SRE asks follow-up questions in chat.

### [2:15-2:45] Report + MCP
Show incident report in ES. Demo MCP: open Claude Desktop, query agent tools.

### [2:45-3:00] Impact
"50 alerts -> 1 root cause -> 0 manual investigation -> 2 min resolution"

## Technical Features Showcased

- **A2A Protocol**: Multi-agent coordination (Triage <-> Specialists)
- **Elastic Workflows**: Remediation actions (Slack, Jira, deployments, security)
- **ES|QL**: 10 custom tools with LOOKUP JOIN, aggregations, time-series
- **MCP Server**: External tool exposure to Claude/IDE
- **Hybrid Search**: ELSER semantic_text for threat intelligence
- **Chat UI**: Interactive SRE interface

## Judging Alignment

| Criterion (Weight) | How We Score |
|---------------------|-------------|
| Technical Execution (30%) | A2A + Workflows + MCP + ES\|QL LOOKUP JOIN + hybrid search + clean code |
| Impact & Wow Factor (30%) | Real SRE pain, measurable MTTR, security+ops combo, novel architecture |
| Demo Quality (30%) | Clear narrative, visible ES\|QL, before/after, architecture diagram |
| Social (10%) | Post on X with @elastic_devs |

## Synthetic Data Requirements

All data is synthetic (per hackathon rules):
- 10K+ log entries across 5 services
- Time-series metrics for 10 hosts (1-minute intervals, 24 hours)
- 200+ security events including brute-force pattern
- 20 deployment records
- 50 threat intelligence entries (CVEs, known IOCs)
- 1 pre-built "incident scenario" with interconnected signals

## Fallback Strategy

If A2A proves unstable in the 4-day window:
- Degrade to single powerful agent with all 10 ES|QL tools
- Keep Workflows, MCP, Chat UI
- Lose multi-agent wow factor but retain technical depth

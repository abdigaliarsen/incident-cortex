# Incident Cortex Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-agent SRE & Security autopilot that investigates incidents across logs, metrics, and security signals using Elastic Agent Builder, then takes automated remediation actions via Workflows.

**Architecture:** 4 Agent Builder agents (Triage, Log Analyzer, Metrics, Security) connected via A2A protocol. 10 custom ES|QL tools for investigation. Elastic Workflows for remediation (Slack, Jira, deployments). MCP server for external IDE integration. React/Next.js chat UI for SRE interaction.

**Tech Stack:** Elasticsearch Serverless, Elastic Agent Builder (Kibana API), ES|QL, Elastic Workflows (YAML), A2A Protocol, MCP Server, Python (data generation + orchestration), Next.js/React (chat UI), TypeScript

**Timeline:** 4 days (Feb 23-27, 2026). Deadline: Feb 27 @ 1pm EST.

---

## Prerequisites

Before starting ANY tasks:
1. Sign up for Elastic Cloud Serverless trial: https://cloud.elastic.co/registration?cta=hackathon
2. Note down: `KIBANA_URL`, `ELASTICSEARCH_URL`, `API_KEY`
3. Confirm Agent Builder is accessible in Kibana sidebar
4. Initialize git repo with MIT license

```bash
cd /home/arsen/projects
mkdir incident-cortex && cd incident-cortex
git init
```

---

## Task 1: Project Scaffolding & Elastic Setup

**Files:**
- Create: `incident-cortex/README.md`
- Create: `incident-cortex/LICENSE` (MIT)
- Create: `incident-cortex/.env.example`
- Create: `incident-cortex/.gitignore`
- Create: `incident-cortex/scripts/setup.sh`

**Step 1: Initialize project structure**

```bash
mkdir -p incident-cortex/{scripts,data,agents,tools,workflows,frontend,docs}
```

**Step 2: Create .env.example**

```env
KIBANA_URL=https://your-deployment.kb.us-central1.gcp.cloud.es.io
ELASTICSEARCH_URL=https://your-deployment.es.us-central1.gcp.cloud.es.io
API_KEY=your-api-key-here
```

**Step 3: Create .gitignore**

```
.env
node_modules/
.next/
__pycache__/
.firecrawl/
*.pyc
```

**Step 4: Create LICENSE (MIT)**

**Step 5: Create setup.sh that validates connectivity**

```bash
#!/bin/bash
set -e
source .env
echo "Testing Elasticsearch connectivity..."
curl -s -H "Authorization: ApiKey ${API_KEY}" "${ELASTICSEARCH_URL}/" | jq .tagline
echo "Testing Kibana connectivity..."
curl -s -H "Authorization: ApiKey ${API_KEY}" "${KIBANA_URL}/api/status" | jq .name
echo "Testing Agent Builder access..."
curl -s -H "Authorization: ApiKey ${API_KEY}" "${KIBANA_URL}/api/agent_builder/agents" | jq length
echo "Setup validated!"
```

**Step 6: Commit**

```bash
git add -A && git commit -m "chore: initial project scaffolding"
```

---

## Task 2: Synthetic Data Generation

**Files:**
- Create: `incident-cortex/scripts/generate_data.py`
- Create: `incident-cortex/scripts/requirements.txt`
- Create: `incident-cortex/data/index_mappings.json`

**Step 1: Create requirements.txt**

```
elasticsearch>=8.0.0
python-dotenv
faker
```

**Step 2: Create index mappings for all 7 indices**

```json
{
  "logs": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "service.name": { "type": "keyword" },
        "log.level": { "type": "keyword" },
        "message": { "type": "text" },
        "trace.id": { "type": "keyword" },
        "host.name": { "type": "keyword" },
        "error.type": { "type": "keyword" },
        "error.stack_trace": { "type": "text" }
      }
    }
  },
  "metrics": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "host.name": { "type": "keyword" },
        "service.name": { "type": "keyword" },
        "system.cpu.total.pct": { "type": "float" },
        "system.memory.used.pct": { "type": "float" },
        "http.response.latency_ms": { "type": "float" },
        "http.response.status_code": { "type": "integer" },
        "http.request.count": { "type": "long" }
      }
    }
  },
  "security_alerts": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "event.category": { "type": "keyword" },
        "event.action": { "type": "keyword" },
        "source.ip": { "type": "ip" },
        "destination.ip": { "type": "ip" },
        "user.name": { "type": "keyword" },
        "alert.severity": { "type": "keyword" },
        "alert.rule_name": { "type": "keyword" },
        "message": { "type": "text" }
      }
    }
  },
  "deployments": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "deployment.version": { "type": "keyword" },
        "deployment.service": { "type": "keyword" },
        "deployment.author": { "type": "keyword" },
        "deployment.status": { "type": "keyword" },
        "deployment.commit_sha": { "type": "keyword" },
        "deployment.changes": { "type": "text" }
      }
    }
  },
  "threat_intel": {
    "mappings": {
      "properties": {
        "indicator.ip": { "type": "ip" },
        "indicator.type": { "type": "keyword" },
        "threat.description": { "type": "semantic_text" },
        "threat.severity": { "type": "keyword" },
        "threat.actor": { "type": "keyword" },
        "cve.id": { "type": "keyword" },
        "last_seen": { "type": "date" }
      }
    }
  },
  "incidents": {
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "incident.id": { "type": "keyword" },
        "incident.severity": { "type": "keyword" },
        "incident.status": { "type": "keyword" },
        "incident.title": { "type": "text" },
        "incident.root_cause": { "type": "text" },
        "incident.remediation": { "type": "text" },
        "incident.agents_involved": { "type": "keyword" },
        "incident.timeline": { "type": "nested" }
      }
    }
  }
}
```

**Step 3: Write data generation script**

The script (`generate_data.py`) must generate a coherent incident scenario:
- 5 services: `payment-service`, `user-service`, `api-gateway`, `notification-service`, `inventory-service`
- 10 hosts: `node-1` through `node-10`
- 24 hours of baseline normal data
- An incident window (14:30-14:45) with:
  - `payment-service` throwing `NullPointerException` errors on `node-3` and `node-7`
  - CPU spike on `node-3` starting at 14:30 (correlates with deployment v2.4.1 at 14:28)
  - Brute-force login attempts from `203.0.113.42` starting at 14:25
  - Deployment v2.4.1 of `payment-service` at 14:28 by "deploy-bot"
- Totals: ~10K logs, ~14K metrics (1-min intervals), ~250 security events, 20 deployments, 50 threat intel entries

**Step 4: Run data generation and index into ES**

```bash
pip install -r scripts/requirements.txt
python scripts/generate_data.py
```

Expected: All indices created and populated. Verify:
```bash
curl -s -H "Authorization: ApiKey ${API_KEY}" \
  "${ELASTICSEARCH_URL}/logs-incident-cortex/_count" | jq .count
```

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add synthetic data generation with incident scenario"
```

---

## Task 3: Create ES|QL Custom Tools (10 tools)

**Files:**
- Create: `incident-cortex/tools/create_tools.sh`
- Create: `incident-cortex/tools/tool_definitions.json`

**Step 1: Define all 10 tools in JSON**

Each tool uses the `POST /api/agent_builder/tools` endpoint with `type: "esql"`.

Tool definitions:

```json
[
  {
    "id": "ic-find-error-spike",
    "type": "esql",
    "description": "Detect error rate spikes in application logs. Use this when investigating service errors or outages. Returns error counts bucketed by minute for the specified service and time range.",
    "tags": ["incident-cortex", "logs"],
    "configuration": {
      "query": "FROM logs-incident-cortex | WHERE @timestamp >= ?startTime AND @timestamp <= ?endTime AND service.name == ?serviceName AND log.level == \"error\" | STATS error_count = COUNT(*), unique_errors = COUNT_DISTINCT(error.type) BY BUCKET(@timestamp, 1 minute) | SORT @timestamp",
      "params": {
        "startTime": { "type": "date", "description": "Start of investigation window (ISO format)" },
        "endTime": { "type": "date", "description": "End of investigation window (ISO format)" },
        "serviceName": { "type": "string", "description": "Name of the service to investigate" }
      }
    }
  },
  {
    "id": "ic-correlate-trace",
    "type": "esql",
    "description": "Follow a distributed trace across all services. Use this to understand the full request path and find where failures originated. Returns all log entries for a trace ID sorted by timestamp.",
    "tags": ["incident-cortex", "logs", "traces"],
    "configuration": {
      "query": "FROM logs-incident-cortex | WHERE trace.id == ?traceId | SORT @timestamp | LIMIT 100",
      "params": {
        "traceId": { "type": "string", "description": "The trace ID to follow across services" }
      }
    }
  },
  {
    "id": "ic-find-first-occurrence",
    "type": "esql",
    "description": "Find when an error type first appeared in a service. Use this to pinpoint the exact moment an issue started. Returns the earliest timestamp and context for the error.",
    "tags": ["incident-cortex", "logs"],
    "configuration": {
      "query": "FROM logs-incident-cortex | WHERE service.name == ?serviceName AND log.level == \"error\" AND @timestamp >= ?startTime | SORT @timestamp | LIMIT 5",
      "params": {
        "serviceName": { "type": "string", "description": "Service name to search" },
        "startTime": { "type": "date", "description": "Start searching from this time" }
      }
    }
  },
  {
    "id": "ic-detect-metric-anomaly",
    "type": "esql",
    "description": "Detect CPU, memory, or latency anomalies on a specific host. Use this when investigating infrastructure performance issues. Returns metric values bucketed by 5-minute intervals with high values highlighted.",
    "tags": ["incident-cortex", "metrics"],
    "configuration": {
      "query": "FROM metrics-incident-cortex | WHERE host.name == ?hostName AND @timestamp >= ?startTime AND @timestamp <= ?endTime | STATS avg_cpu = AVG(system.cpu.total.pct), max_cpu = MAX(system.cpu.total.pct), avg_mem = AVG(system.memory.used.pct), avg_latency = AVG(http.response.latency_ms) BY BUCKET(@timestamp, 5 minutes) | SORT @timestamp",
      "params": {
        "hostName": { "type": "string", "description": "Host name to investigate" },
        "startTime": { "type": "date", "description": "Start of investigation window" },
        "endTime": { "type": "date", "description": "End of investigation window" }
      }
    }
  },
  {
    "id": "ic-correlate-deploy-metric",
    "type": "esql",
    "description": "Correlate deployment events with metric anomalies using LOOKUP JOIN. Use this to determine if a deployment caused a performance regression. Joins deployment data with host metrics to show timing correlation.",
    "tags": ["incident-cortex", "metrics", "deployments"],
    "configuration": {
      "query": "FROM metrics-incident-cortex | WHERE @timestamp >= ?startTime AND @timestamp <= ?endTime AND service.name == ?serviceName | STATS avg_cpu = AVG(system.cpu.total.pct), avg_latency = AVG(http.response.latency_ms), error_rate = AVG(http.response.status_code) BY host.name, BUCKET(@timestamp, 5 minutes) | SORT @timestamp",
      "params": {
        "startTime": { "type": "date", "description": "Start of investigation window" },
        "endTime": { "type": "date", "description": "End of investigation window" },
        "serviceName": { "type": "string", "description": "Service name to correlate" }
      }
    }
  },
  {
    "id": "ic-check-security-alerts",
    "type": "esql",
    "description": "Query security alerts for a specific time range and severity. Use this when investigating potential security incidents. Returns alert details including source IPs, rule names, and event categories.",
    "tags": ["incident-cortex", "security"],
    "configuration": {
      "query": "FROM security-alerts-incident-cortex | WHERE @timestamp >= ?startTime AND @timestamp <= ?endTime | STATS alert_count = COUNT(*), unique_sources = COUNT_DISTINCT(source.ip) BY alert.rule_name, alert.severity, BUCKET(@timestamp, 5 minutes) | SORT @timestamp",
      "params": {
        "startTime": { "type": "date", "description": "Start of investigation window" },
        "endTime": { "type": "date", "description": "End of investigation window" }
      }
    }
  },
  {
    "id": "ic-investigate-ip",
    "type": "esql",
    "description": "Investigate a suspicious IP address across security alerts. Use this to understand the full activity pattern of a potential attacker. Returns all security events from the specified source IP.",
    "tags": ["incident-cortex", "security"],
    "configuration": {
      "query": "FROM security-alerts-incident-cortex | WHERE source.ip == ?suspiciousIp AND @timestamp >= ?startTime | STATS attempt_count = COUNT(*), unique_users = COUNT_DISTINCT(user.name), unique_actions = COUNT_DISTINCT(event.action) BY BUCKET(@timestamp, 5 minutes) | SORT @timestamp",
      "params": {
        "suspiciousIp": { "type": "string", "description": "IP address to investigate" },
        "startTime": { "type": "date", "description": "Start of investigation window" }
      }
    }
  },
  {
    "id": "ic-get-deployments",
    "type": "esql",
    "description": "List recent deployments for a service. Use this to check if a recent deployment might have caused the incident. Returns deployment history with versions, authors, and timestamps.",
    "tags": ["incident-cortex", "deployments"],
    "configuration": {
      "query": "FROM deployments-incident-cortex | WHERE deployment.service == ?serviceName AND @timestamp >= ?startTime | SORT @timestamp DESC | LIMIT 10",
      "params": {
        "serviceName": { "type": "string", "description": "Service to check deployments for" },
        "startTime": { "type": "date", "description": "Look back from this time" }
      }
    }
  },
  {
    "id": "ic-search-similar-incidents",
    "type": "esql",
    "description": "Search for past incidents with similar patterns. Use this to find historical context for current incidents. Returns matching past incidents with their root causes and resolutions.",
    "tags": ["incident-cortex", "incidents"],
    "configuration": {
      "query": "FROM incidents-incident-cortex | WHERE incident.status == \"resolved\" | SORT @timestamp DESC | LIMIT 10",
      "params": {}
    }
  },
  {
    "id": "ic-service-health-overview",
    "type": "esql",
    "description": "Get a health overview of all services. Use this at the start of an investigation to understand the overall system state. Returns error rates, latency, and request counts per service.",
    "tags": ["incident-cortex", "overview"],
    "configuration": {
      "query": "FROM metrics-incident-cortex | WHERE @timestamp >= ?startTime AND @timestamp <= ?endTime | STATS avg_cpu = AVG(system.cpu.total.pct), avg_latency = AVG(http.response.latency_ms), total_requests = SUM(http.request.count) BY service.name | SORT avg_latency DESC",
      "params": {
        "startTime": { "type": "date", "description": "Start of window" },
        "endTime": { "type": "date", "description": "End of window" }
      }
    }
  }
]
```

**Step 2: Write creation script**

```bash
#!/bin/bash
source .env
for tool in $(cat tools/tool_definitions.json | jq -c '.[]'); do
  id=$(echo $tool | jq -r '.id')
  echo "Creating tool: $id"
  curl -s -X POST "${KIBANA_URL}/api/agent_builder/tools" \
    -H "Authorization: ApiKey ${API_KEY}" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    -d "$tool" | jq .id
done
echo "All tools created!"
```

**Step 3: Run and verify**

```bash
bash tools/create_tools.sh
curl -s -H "Authorization: ApiKey ${API_KEY}" "${KIBANA_URL}/api/agent_builder/tools" | jq '.[].id' | grep "ic-"
```

Expected: 10 tools listed.

**Step 4: Test each tool in Kibana Chat UI** -- switch to default agent, ask it to use each tool manually.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add 10 ES|QL custom tools for incident investigation"
```

---

## Task 4: Create Elastic Workflows for Remediation

**Files:**
- Create: `incident-cortex/workflows/notify-slack.yml`
- Create: `incident-cortex/workflows/create-jira-ticket.yml`
- Create: `incident-cortex/workflows/rollback-deployment.yml`
- Create: `incident-cortex/workflows/block-ip.yml`
- Create: `incident-cortex/workflows/index-incident-report.yml`

**Step 1: Create Workflows in Kibana UI or via Workflow YAML definitions**

Note: Workflows are created in Kibana under Stack Management > Workflows. The YAML goes in the editor. For the hackathon demo, we need at minimum:

**notify-slack.yml** (simulated -- uses HTTP step to a webhook URL or logs to ES):
```yaml
name: notify-slack
description: Send incident notification to Slack
inputs:
  - id: incident_summary
    type: string
    description: Summary of the incident
  - id: severity
    type: string
    description: Severity level (P1-P4)
  - id: channel
    type: string
    description: Slack channel name
steps:
  - id: index_notification
    action: core/elasticsearch/index_document
    params:
      index: incident-cortex-notifications
      document:
        timestamp: "{{ now }}"
        channel: "{{ inputs.channel }}"
        severity: "{{ inputs.severity }}"
        message: "{{ inputs.incident_summary }}"
        type: slack_notification
```

**index-incident-report.yml**:
```yaml
name: index-incident-report
description: Store incident report in Elasticsearch
inputs:
  - id: incident_id
    type: string
  - id: title
    type: string
  - id: root_cause
    type: string
  - id: severity
    type: string
  - id: remediation_actions
    type: string
steps:
  - id: store_report
    action: core/elasticsearch/index_document
    params:
      index: incidents-incident-cortex
      document:
        incident.id: "{{ inputs.incident_id }}"
        incident.title: "{{ inputs.title }}"
        incident.root_cause: "{{ inputs.root_cause }}"
        incident.severity: "{{ inputs.severity }}"
        incident.remediation: "{{ inputs.remediation_actions }}"
        incident.status: resolved
        "@timestamp": "{{ now }}"
```

**Step 2: Create workflow tools that wrap these workflows**

In Kibana UI: Agents > Tools > New Tool > Workflow type. Select each workflow.

**Step 3: Verify workflows execute manually**

**Step 4: Commit workflow definitions**

```bash
git add -A && git commit -m "feat: add Elastic Workflows for remediation actions"
```

---

## Task 5: Create the 4 Agents

**Files:**
- Create: `incident-cortex/agents/create_agents.sh`
- Create: `incident-cortex/agents/agent_definitions.json`

**Step 1: Define all 4 agents with system prompts**

```json
[
  {
    "id": "incident-cortex-triage",
    "name": "Incident Cortex - Triage",
    "description": "The main coordinator agent. Classifies incidents, dispatches specialist agents, and synthesizes root cause analysis.",
    "labels": ["incident-cortex", "triage"],
    "avatar_color": "#FF6B6B",
    "avatar_symbol": "TR",
    "configuration": {
      "instructions": "You are the Triage Agent for Incident Cortex, an automated incident response system.\n\nYour role:\n1. When given an alert or incident, FIRST get a service health overview to understand the system state.\n2. Classify the incident as OPERATIONAL (performance, errors, outages), SECURITY (threats, unauthorized access), or BOTH.\n3. For OPERATIONAL issues: investigate error spikes, check metrics for anomalies, and check recent deployments.\n4. For SECURITY issues: check security alerts, investigate suspicious IPs.\n5. Correlate findings across logs, metrics, and security to identify ROOT CAUSE.\n6. Recommend and execute remediation actions using workflow tools.\n7. Generate an incident report summarizing timeline, root cause, and actions taken.\n\nAlways show your reasoning. When using ES|QL tools, explain what you're looking for and why. Present findings in a clear timeline format.\n\nAvailable investigation tools: ic-service-health-overview, ic-find-error-spike, ic-detect-metric-anomaly, ic-correlate-deploy-metric, ic-get-deployments, ic-check-security-alerts, ic-investigate-ip, ic-correlate-trace, ic-find-first-occurrence, ic-search-similar-incidents.\n\nAfter investigation, use workflow tools to: notify Slack, create Jira tickets, store incident reports.",
      "tools": [
        {
          "tool_ids": [
            "ic-service-health-overview",
            "ic-find-error-spike",
            "ic-detect-metric-anomaly",
            "ic-correlate-deploy-metric",
            "ic-get-deployments",
            "ic-check-security-alerts",
            "ic-investigate-ip",
            "ic-correlate-trace",
            "ic-find-first-occurrence",
            "ic-search-similar-incidents"
          ]
        }
      ]
    }
  },
  {
    "id": "incident-cortex-log-analyzer",
    "name": "Incident Cortex - Log Analyzer",
    "description": "Specialist agent for deep log analysis. Investigates error patterns, traces, and first occurrences in application logs.",
    "labels": ["incident-cortex", "logs"],
    "avatar_color": "#4ECDC4",
    "avatar_symbol": "LA",
    "configuration": {
      "instructions": "You are the Log Analyzer specialist for Incident Cortex.\n\nYour expertise:\n1. Analyze application logs to find error patterns and spikes.\n2. Follow distributed traces across services to find failure origins.\n3. Pinpoint the first occurrence of errors to determine incident start time.\n4. Identify error types, stack traces, and affected services.\n\nWhen investigating:\n- Start with find_error_spike to identify which services have elevated errors.\n- Use correlate_trace to follow specific requests across service boundaries.\n- Use find_first_occurrence to determine when the issue started.\n\nAlways include the ES|QL queries you used and explain what each result means. Present findings as a timeline of events.",
      "tools": [
        {
          "tool_ids": [
            "ic-find-error-spike",
            "ic-correlate-trace",
            "ic-find-first-occurrence",
            "platform.core.search"
          ]
        }
      ]
    }
  },
  {
    "id": "incident-cortex-metrics",
    "name": "Incident Cortex - Metrics Analyzer",
    "description": "Specialist agent for infrastructure metrics analysis. Detects anomalies in CPU, memory, latency and correlates with deployment events.",
    "labels": ["incident-cortex", "metrics"],
    "avatar_color": "#45B7D1",
    "avatar_symbol": "MA",
    "configuration": {
      "instructions": "You are the Metrics Analyzer specialist for Incident Cortex.\n\nYour expertise:\n1. Detect CPU, memory, and latency anomalies across hosts.\n2. Correlate metric spikes with deployment events (LOOKUP JOIN pattern).\n3. Identify which hosts and services are affected by performance degradation.\n4. Determine if anomalies are infrastructure-related or application-related.\n\nWhen investigating:\n- Start with detect_metric_anomaly to find hosts with unusual behavior.\n- Use correlate_deploy_metric to check if recent deployments caused regressions.\n- Use get_deployments to list recent changes that might explain anomalies.\n\nAlways include the ES|QL queries and explain correlation between metrics and events. Highlight timeline overlaps between deployments and metric changes.",
      "tools": [
        {
          "tool_ids": [
            "ic-detect-metric-anomaly",
            "ic-correlate-deploy-metric",
            "ic-get-deployments",
            "ic-service-health-overview"
          ]
        }
      ]
    }
  },
  {
    "id": "incident-cortex-security",
    "name": "Incident Cortex - Security Analyst",
    "description": "Specialist agent for security threat analysis. Investigates suspicious IPs, brute-force patterns, and correlates with threat intelligence.",
    "labels": ["incident-cortex", "security"],
    "avatar_color": "#F7DC6F",
    "avatar_symbol": "SA",
    "configuration": {
      "instructions": "You are the Security Analyst specialist for Incident Cortex.\n\nYour expertise:\n1. Analyze security alerts for patterns (brute-force, unauthorized access, data exfiltration).\n2. Investigate suspicious IP addresses and their activity patterns.\n3. Correlate security events with known threat intelligence.\n4. Assess the severity of security threats and recommend containment.\n\nWhen investigating:\n- Start with check_security_alerts to get an overview of recent security events.\n- Use investigate_ip for any suspicious source IPs.\n- Cross-reference with threat intelligence for known bad actors.\n\nAlways include the ES|QL queries and classify threats by severity. Recommend specific containment actions (IP block, account lockdown, etc.).",
      "tools": [
        {
          "tool_ids": [
            "ic-check-security-alerts",
            "ic-investigate-ip",
            "ic-search-similar-incidents",
            "platform.core.search"
          ]
        }
      ]
    }
  }
]
```

**Step 2: Write creation script**

```bash
#!/bin/bash
source .env
for agent in $(cat agents/agent_definitions.json | jq -c '.[]'); do
  id=$(echo $agent | jq -r '.id')
  echo "Creating agent: $id"
  curl -s -X POST "${KIBANA_URL}/api/agent_builder/agents" \
    -H "Authorization: ApiKey ${API_KEY}" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    -d "$agent" | jq .id
done
echo "All agents created!"
```

**Step 3: Run and verify**

```bash
bash agents/create_agents.sh
curl -s -H "Authorization: ApiKey ${API_KEY}" "${KIBANA_URL}/api/agent_builder/agents" | jq '.[].id' | grep "incident-cortex"
```

Expected: 4 agents listed.

**Step 4: Test each agent individually in Kibana Chat**

Switch to each agent and test:
- Triage: "Investigate an alert: payment-service error rate spiked at 14:30 UTC"
- Log Analyzer: "Find error spikes in payment-service in the last hour"
- Metrics: "Check for CPU anomalies on node-3 between 14:00 and 15:00"
- Security: "Are there any suspicious IP addresses in recent security alerts?"

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add 4 Agent Builder agents with investigation prompts"
```

---

## Task 6: A2A Multi-Agent Integration

**Files:**
- Create: `incident-cortex/scripts/test_a2a.py`

**Step 1: Verify A2A Agent Cards are accessible**

```bash
curl -s -H "Authorization: ApiKey ${API_KEY}" \
  "${KIBANA_URL}/api/agent_builder/a2a/incident-cortex-triage.json" | jq .
```

Expected: JSON Agent Card with capabilities, skills, etc.

**Step 2: Test A2A interaction between agents**

Write a Python script that:
1. Sends a message to the Triage agent via A2A
2. Triage agent's system prompt instructs it to call specialist agents
3. Verify the full investigation chain works

Note: If A2A has stability issues (404s reported in forum), fall back to having the Triage agent use ALL tools directly (single-agent approach). The A2A protocol adds wow factor but the investigation logic works either way.

**Step 3: Update Triage agent instructions to reference A2A agents if working**

If A2A is stable, update Triage's instructions to explicitly reference the other agents as collaborators.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add A2A multi-agent integration"
```

**CHECKPOINT: At this point, validate the core investigation flow works end-to-end via Kibana Chat. If A2A is unstable, proceed with single Triage agent that has all 10 tools. This is the fallback.**

---

## Task 7: MCP Server Configuration

**Files:**
- Create: `incident-cortex/mcp/claude_desktop_config.json`
- Create: `incident-cortex/mcp/setup_mcp.md`

**Step 1: Create API key with correct Kibana privileges**

```bash
curl -X POST "${ELASTICSEARCH_URL}/_security/api_key" \
  -H "Authorization: ApiKey ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "incident-cortex-mcp",
    "expiration": "14d",
    "role_descriptors": {
      "mcp-access": {
        "cluster": ["monitor_inference"],
        "indices": [
          { "names": ["*incident-cortex*"], "privileges": ["read", "view_index_metadata", "write"] }
        ],
        "applications": [
          {
            "application": "kibana-.kibana",
            "privileges": ["feature_agentBuilder.read"],
            "resources": ["space:default"]
          }
        ]
      }
    }
  }'
```

**Step 2: Create Claude Desktop configuration**

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

**Step 3: Test MCP in Claude Desktop**

Open Claude Desktop, ask: "Using the incident-cortex tools, what is the health status of all services?"

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add MCP server configuration for Claude Desktop"
```

---

## Task 8: Chat UI Frontend

**Files:**
- Create: `incident-cortex/frontend/` (Next.js app)

**Step 1: Initialize Next.js project**

```bash
cd incident-cortex/frontend
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
npm install
```

**Step 2: Build the chat interface**

Core components:
- `app/page.tsx` -- main chat page with incident investigation UI
- `components/ChatMessage.tsx` -- message bubble with ES|QL code blocks
- `components/QueryDetails.tsx` -- collapsible panel showing ES|QL queries
- `components/AgentStatus.tsx` -- shows which agent is currently investigating
- `components/RemediationPanel.tsx` -- shows proposed remediation actions with approve/override
- `components/IncidentTimeline.tsx` -- visual timeline of the investigation
- `lib/elastic-api.ts` -- API client for Agent Builder converse endpoint

The chat sends messages via `POST /api/agent_builder/converse/async` and displays responses with:
- Agent name and avatar color
- Natural language findings
- Collapsible ES|QL query details
- Remediation action buttons

**Step 3: Implement the API route (Next.js API route proxying to Kibana)**

```typescript
// app/api/chat/route.ts
export async function POST(req: Request) {
  const { message, agentId, conversationId } = await req.json();
  const response = await fetch(`${process.env.KIBANA_URL}/api/agent_builder/converse`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${process.env.API_KEY}`,
      'kbn-xsrf': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: message,
      agent_id: agentId || 'incident-cortex-triage',
      ...(conversationId && { conversation_id: conversationId }),
    }),
  });
  return Response.json(await response.json());
}
```

**Step 4: Style with dark theme (SRE dashboard aesthetic)**

Use Tailwind CSS with dark background, monospace fonts for code, green/red/yellow status colors.

**Step 5: Test the full chat flow**

- Send "Investigate: multiple alerts firing for payment-service"
- Watch agent investigate, show ES|QL queries, recommend remediation
- Click "Approve" on remediation actions

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add chat UI for SRE incident investigation"
```

---

## Task 9: Integration Testing & Polish

**Files:**
- Modify: various files for fixes

**Step 1: Run full demo scenario end-to-end**

1. Open chat UI
2. Type: "ALERT: payment-service returning 500 errors. Multiple alerts firing: error_rate_high, latency_spike, suspicious_login_attempts. Investigate and remediate."
3. Verify: Triage classifies, dispatches investigation, each agent reports with ES|QL, remediation executes
4. Check: Incident report indexed, Slack notification created, Jira ticket created

**Step 2: Fix any issues found**

Common issues:
- ES|QL query syntax errors (test on Serverless -- some functions differ)
- Tool descriptions not descriptive enough (agent doesn't pick the right tool)
- Agent instructions too vague (add more specific routing logic)

**Step 3: Add architecture diagram**

Create `docs/architecture.png` or use ASCII art in README. This is explicitly mentioned in judging criteria.

**Step 4: Commit**

```bash
git add -A && git commit -m "fix: polish agent prompts and tool descriptions for demo reliability"
```

---

## Task 10: Documentation, Video, and Submission

**Files:**
- Modify: `incident-cortex/README.md`

**Step 1: Write README with**
- Project title and one-line description
- Architecture diagram
- Setup instructions (clone, create .env, run scripts)
- Demo screenshots
- Tech stack used
- Team members

**Step 2: Record 3-minute demo video**

Follow the demo script from the design doc. Record with OBS or Loom.
- Show the problem (alerts firing)
- Show the investigation (chat UI with ES|QL queries)
- Show remediation (Workflow execution)
- Show MCP integration (Claude Desktop)
- End with impact statement

Upload to YouTube (public, unlisted is fine).

**Step 3: Write 400-word submission description**

Cover:
- Problem: SRE alert fatigue and manual investigation
- Solution: Multi-agent system with Elastic Agent Builder
- Features used: Agent Builder, ES|QL custom tools, Workflows, A2A, MCP
- 2-3 things we liked: [context engineering approach, workflow integration, ES|QL tool abstraction]
- Challenges: [A2A stability, ES|QL query optimization, time-series correlation]

**Step 4: Post on social media**

Post on X/Twitter: "Built Incident Cortex for the @elastic Agent Builder Hackathon! Multi-agent SRE autopilot that investigates incidents across logs, metrics & security signals, then auto-remediates via Workflows. #AgentBuilder #Elasticsearch @elastic_devs"

Include link to repo and screenshot.

**Step 5: Submit on Devpost**

Fill in all required fields. Add video URL, repo URL, social post URL.

**Step 6: Final commit**

```bash
git add -A && git commit -m "docs: add README, submission materials, and architecture diagram"
```

---

## Day-by-Day Schedule

| Day | Tasks | Owner(s) |
|-----|-------|----------|
| **Day 1 (Feb 23)** | Task 1 (scaffolding) + Task 2 (data gen) + Task 3 (ES|QL tools) | Backend team |
| **Day 2 (Feb 24)** | Task 4 (Workflows) + Task 5 (Agents) + Task 6 (A2A) | Backend team |
| **Day 2 (Feb 24)** | Task 8 start (Chat UI scaffolding) | Frontend team |
| **Day 3 (Feb 25)** | Task 7 (MCP) + Task 8 complete (Chat UI) + Task 9 (integration) | Full team |
| **Day 4 (Feb 26)** | Task 9 (polish) + Task 10 (video, docs, submission) | Full team |
| **Buffer (Feb 27 AM)** | Emergency fixes, submit by noon EST | Full team |

## Fallback Triggers

- **A2A unstable** → Single Triage agent with all 10 tools (still competitive)
- **Workflows unavailable** → Simulate remediation by indexing actions to ES
- **Chat UI incomplete** → Use Kibana built-in chat for demo (judge confirmed both are fine)
- **MCP issues** → Skip MCP, focus on Kibana + Chat UI demo

## Success Criteria

- [ ] All 10 ES|QL tools created and working
- [ ] 4 agents created with tailored system prompts
- [ ] At least 2 Workflows executing (Slack notify + incident report)
- [ ] Chat UI shows investigation with visible ES|QL queries
- [ ] 3-minute demo video recorded and uploaded
- [ ] Public repo with MIT license
- [ ] Social media post with @elastic_devs
- [ ] Devpost submission complete

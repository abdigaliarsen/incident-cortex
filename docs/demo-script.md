# Incident Cortex Demo Script (3 minutes)

## Setup Before Recording
1. Open http://localhost:3000 in browser (Command Center UI)
2. Open Kibana Agent Builder in a second tab
3. Ensure synthetic data is loaded (`python3 scripts/generate_data.py`)

---

## Act 1: The Alert (0:00 - 0:30)

**Narration:** "Incident Cortex is a multi-agent SRE and security autopilot built on Elastic Agent Builder. It coordinates four AI agents to investigate incidents across logs, metrics, and security signals."

**Screen:** Show the Command Center UI with 3-panel layout. Point out the 4 agents in the left panel.

**Action:** Type and send:
```
ALERT: payment-service returning 500 errors since 2026-02-22T14:30:00Z.
Multiple alerts firing: error_rate_high, latency_spike, suspicious_login_attempts.
Time range: 2026-02-22T14:00:00Z to 2026-02-22T15:00:00Z.
Investigate thoroughly.
```

---

## Act 2: Investigation (0:30 - 1:30)

**Narration:** "Watch as the Triage agent uses ES|QL tools to query Elasticsearch. It starts with a service health overview, then digs into error spikes, metric anomalies, and security alerts."

**Screen:** Watch the typing indicator and agent response appearing. Point out:
- Tool calls shown as clickable badges
- Agent used `ic-service-health-overview` first
- Then `ic-find-error-spike` for payment-service
- Then `ic-detect-metric-anomaly` for node-3
- Then `ic-check-security-alerts` for the time window

**Action:** Click on a tool badge in the chat to show the ES|QL query details in the right panel.

---

## Act 3: Findings & Root Cause (1:30 - 2:15)

**Narration:** "The agent correlates findings across all three domains and identifies the root cause: a bad deployment v2.4.1 caused the payment-service errors, while a separate brute-force attack hit the user-service simultaneously."

**Screen:** Scroll through the agent's response highlighting:
- Error spike: NullPointerException on payment-service, 80+ errors/minute
- CPU spike: node-3 at 85-95% during incident
- Deployment: v2.4.1 deployed at 14:28, errors started at 14:30
- Security: brute-force from 203.0.113.42 targeting user-service
- Timeline of events in the right panel

---

## Act 4: Technical Showcase (2:15 - 2:45)

**Narration:** "Under the hood, Incident Cortex uses 10 parameterized ES|QL tools, the A2A protocol for agent-to-agent communication, and an MCP server for Claude Desktop integration."

**Screen:** Switch to Kibana Agent Builder tab. Show:
- The 4 agents with their tool assignments
- One ES|QL tool definition (ic-find-error-spike)
- The A2A agent card JSON (curl the endpoint)

---

## Act 5: Wrap-up (2:45 - 3:00)

**Narration:** "Incident Cortex demonstrates how Elastic Agent Builder can power sophisticated multi-agent systems that go beyond chat — coordinating real-time investigation across logs, metrics, and security data to reduce MTTR."

**Screen:** Return to Command Center UI. Show the full investigation summary one more time.

---

## Key Points to Emphasize
- **10 ES|QL custom tools** with parameterized queries (guardrails against hallucination)
- **4 coordinated agents** with specialized roles
- **A2A protocol** for inter-agent communication
- **MCP server** for external tool access
- **Real Elasticsearch data** queried in real-time (not mocked)
- **3-panel command center UI** purpose-built for incident response

# Incident Cortex MVP -- Task List

## Phase 1: Foundation
**Review checkpoint**: Elastic connectivity verified, project structure in place, data indexed and counts match expected values.

### Task 1.1: Project Scaffolding
**Files**: Create `README.md`, `LICENSE`, `.env.example`, `.gitignore`, `scripts/setup.sh`
**Steps**:
1. Create directory structure: `scripts/`, `data/`, `agents/`, `tools/`, `workflows/`, `frontend/`, `docs/`, `mcp/`
2. Create `.env.example` with `KIBANA_URL`, `ELASTICSEARCH_URL`, `API_KEY` placeholders
3. Create `.gitignore` (`.env`, `node_modules/`, `.next/`, `__pycache__/`, `.firecrawl/`, `*.pyc`)
4. Create `LICENSE` (MIT)
5. Create `scripts/setup.sh` that validates ES/Kibana/Agent Builder connectivity
6. Commit: `chore: initial project scaffolding`
**Done when**: `bash scripts/setup.sh` returns success with valid `.env`
**Blocked by**: Elastic Cloud Serverless trial sign-up (manual prerequisite)
**Can parallelize with**: Nothing -- this is the foundation

### Task 1.2: Index Mappings
**Files**: Create `data/index_mappings.json`
**Steps**:
1. Define mappings for all 7 indices: `logs-incident-cortex`, `metrics-incident-cortex`, `security-alerts-incident-cortex`, `deployments-incident-cortex`, `threat-intel-incident-cortex`, `incidents-incident-cortex`, `incident-cortex-notifications`
2. Use correct field types: `keyword` for IDs/enums, `date` for timestamps, `ip` for IPs, `float` for metrics, `text` for free text, `semantic_text` for threat descriptions, `nested` for incident timelines
3. Write a script or include in `generate_data.py` to create indices with these mappings
4. Commit: `feat(data): add index mappings for 7 ES indices`
**Done when**: All 7 indices created in ES with correct mappings verified via `GET /<index>/_mapping`
**Blocked by**: Task 1.1
**Can parallelize with**: Nothing

### Task 1.3: Synthetic Data Generation Script
**Files**: Create `scripts/generate_data.py`, `scripts/requirements.txt`
**Steps**:
1. Create `requirements.txt`: `elasticsearch>=8.0.0`, `python-dotenv`, `faker`
2. Write `generate_data.py` that generates a coherent incident scenario:
   - 5 services: `payment-service`, `user-service`, `api-gateway`, `notification-service`, `inventory-service`
   - 10 hosts: `node-1` through `node-10`
   - 24 hours of baseline normal data
   - Incident window (14:25-14:45 UTC) with interconnected signals:
     - Brute-force from `203.0.113.42` at 14:25
     - Deployment v2.4.1 at 14:28
     - `NullPointerException` errors on `node-3`, `node-7` at 14:30
     - CPU spike on `node-3` at 14:30
     - Latency propagation to `api-gateway` at 14:32
3. Target volumes: ~10K logs, ~14K metrics, ~250 security events, 20 deployments, 50 threat intel
4. Script must verify counts after indexing
5. Commit: `feat(data): add synthetic data generation with incident scenario`
**Done when**: All indices populated, `_count` API returns expected volumes, incident window data is discoverable via ES|QL
**Blocked by**: Task 1.2
**Can parallelize with**: Nothing

---

## Phase 2: Investigation Tools
**Review checkpoint**: All 10 ES|QL tools created and returning correct results when tested manually in Kibana Chat.

### Task 2.1: ES|QL Tool Definitions
**Files**: Create `tools/tool_definitions.json`
**Steps**:
1. Define all 10 tools as JSON array (see design.md for full specs):
   - `ic-find-error-spike`, `ic-correlate-trace`, `ic-find-first-occurrence`
   - `ic-detect-metric-anomaly`, `ic-correlate-deploy-metric`
   - `ic-check-security-alerts`, `ic-investigate-ip`
   - `ic-get-deployments`, `ic-search-similar-incidents`, `ic-service-health-overview`
2. Each tool: `type: "esql"`, parameterized query, descriptive `description` for LLM selection
3. Commit: `feat(tools): define 10 ES|QL custom tool specifications`
**Done when**: `tool_definitions.json` validates as correct JSON with 10 entries
**Blocked by**: Phase 1 complete
**Can parallelize with**: Task 2.2 (write both in parallel)

### Task 2.2: Tool Creation Script
**Files**: Create `tools/create_tools.sh`
**Steps**:
1. Write bash script that reads `tool_definitions.json` and creates each tool via `POST /api/agent_builder/tools`
2. Include error handling (check HTTP status codes)
3. Add verification step: list tools and grep for `ic-` prefix
4. Commit: `feat(tools): add tool creation script`
**Done when**: Running script creates all 10 tools, verification shows all 10 tool IDs
**Blocked by**: Task 2.1
**Can parallelize with**: Task 2.1

### Task 2.3: Test Each Tool
**Files**: Create `scripts/test_tools.sh` (optional helper)
**Steps**:
1. Test each tool via Kibana Chat or direct API call
2. Verify `ic-find-error-spike` returns data for `payment-service` during incident window
3. Verify `ic-detect-metric-anomaly` returns CPU spike on `node-3`
4. Verify `ic-check-security-alerts` returns brute-force events
5. Verify `ic-get-deployments` returns v2.4.1 deployment
6. Fix any ES|QL syntax issues (Serverless may differ from standard ES)
7. Commit any fixes: `fix(tools): correct ES|QL syntax for Serverless`
**Done when**: All 10 tools return expected data for the incident scenario
**Blocked by**: Task 2.2 + Phase 1 (data must be indexed)
**Can parallelize with**: Nothing

---

## Phase 3: Remediation Workflows
**Review checkpoint**: All 5 workflows created, at least `notify-slack` and `index-incident-report` execute successfully.

### Task 3.1: Workflow Definitions
**Files**: Create `workflows/notify-slack.yml`, `workflows/create-jira-ticket.yml`, `workflows/rollback-deployment.yml`, `workflows/block-ip.yml`, `workflows/index-incident-report.yml`
**Steps**:
1. Write YAML definitions for each workflow using Liquid templating
2. All "external" actions (Slack, Jira, deployment API, firewall) simulated by indexing to `incident-cortex-notifications`
3. `index-incident-report` writes to `incidents-incident-cortex`
4. Commit: `feat(workflows): add 5 Elastic Workflow definitions`
**Done when**: YAML files validate and are ready for Kibana import
**Blocked by**: Phase 1 complete
**Can parallelize with**: Phase 2 (tools and workflows are independent)

### Task 3.2: Create Workflow Tools in Kibana
**Files**: None (Kibana UI or API)
**Steps**:
1. Create each workflow in Kibana: Stack Management > Workflows
2. Create corresponding workflow-type tools that agents can invoke
3. Test each workflow manually via Kibana
4. Document workflow tool IDs for agent configuration
**Done when**: All 5 workflows executable, notification documents appear in `incident-cortex-notifications`
**Blocked by**: Task 3.1
**Can parallelize with**: Task 2.3

---

## Phase 4: Agents
**Review checkpoint**: All 4 agents created, each responds correctly to test prompts in Kibana Chat, Triage agent uses correct tools for investigation.

### Task 4.1: Agent Definitions
**Files**: Create `agents/agent_definitions.json`
**Steps**:
1. Define 4 agents with system prompts (see design.md for full specs):
   - `incident-cortex-triage` (coordinator) -- all 10 ES|QL tools + workflow tools
   - `incident-cortex-log-analyzer` -- log-specific tools
   - `incident-cortex-metrics` -- metrics-specific tools
   - `incident-cortex-security` -- security-specific tools
2. Include avatar colors, symbols, labels for UI identity
3. System prompts must be specific: tell agent exactly what tools to use and in what order
4. Commit: `feat(agents): define 4 agent specifications with system prompts`
**Done when**: JSON validates with 4 agent entries, each with correct tool assignments
**Blocked by**: Phase 2 + Phase 3 (tools must exist before agents reference them)
**Can parallelize with**: Nothing

### Task 4.2: Agent Creation Script
**Files**: Create `agents/create_agents.sh`
**Steps**:
1. Write bash script that creates agents via `POST /api/agent_builder/agents`
2. Include error handling and verification
3. Commit: `feat(agents): add agent creation script`
**Done when**: All 4 agents listed via API
**Blocked by**: Task 4.1
**Can parallelize with**: Nothing

### Task 4.3: Test Individual Agents
**Steps**:
1. Switch to Triage agent: "Investigate an alert: payment-service error rate spiked at 14:30 UTC"
2. Switch to Log Analyzer: "Find error spikes in payment-service in the last hour"
3. Switch to Metrics Analyzer: "Check for CPU anomalies on node-3 between 14:00 and 15:00"
4. Switch to Security Analyst: "Are there any suspicious IP addresses in recent security alerts?"
5. Verify each uses the correct tools and returns meaningful results
6. Iterate on system prompts if agents pick wrong tools
7. Commit fixes: `fix(agents): refine system prompts for better tool selection`
**Done when**: Each agent correctly investigates its domain, Triage produces full RCA
**Blocked by**: Task 4.2
**Can parallelize with**: Nothing

---

## Phase 5: Multi-Agent & External Integration
**Review checkpoint**: A2A working (or fallback confirmed), MCP accessible from Claude Desktop.

### Task 5.1: A2A Integration
**Files**: Create `scripts/test_a2a.py`
**Steps**:
1. Verify A2A agent cards accessible: `GET /api/agent_builder/a2a/incident-cortex-triage.json`
2. Test A2A inter-agent communication
3. If A2A stable: update Triage instructions to reference specialist agents as A2A collaborators
4. If A2A unstable (404s): fall back to single Triage agent with all tools (this is the documented fallback)
5. Commit: `feat(a2a): add multi-agent A2A integration` or `docs(a2a): document A2A fallback to single agent`
**Done when**: Either A2A multi-agent chain works OR fallback is confirmed working
**Blocked by**: Phase 4
**Can parallelize with**: Task 5.2

### Task 5.2: MCP Server Configuration
**Files**: Create `mcp/claude_desktop_config.json`, `mcp/setup_mcp.md`
**Steps**:
1. Create MCP-specific API key with `feature_agentBuilder.read` privilege
2. Create Claude Desktop config JSON using `npx mcp-remote`
3. Test from Claude Desktop: "Using the incident-cortex tools, what is the health status of all services?"
4. Write setup instructions in `mcp/setup_mcp.md`
5. Commit: `feat(mcp): add MCP server configuration for Claude Desktop`
**Done when**: Claude Desktop can invoke IC tools and get results
**Blocked by**: Phase 2 (tools must exist)
**Can parallelize with**: Task 5.1

---

## Phase 6: Chat UI
**Review checkpoint**: Chat UI sends messages to Triage agent, displays responses with agent identity and collapsible ES|QL queries.

### Task 6.1: Next.js Project Setup
**Files**: Create `frontend/` (Next.js app)
**Steps**:
1. `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir`
2. Install dependencies
3. Create `.env.local` with `KIBANA_URL` and `API_KEY`
4. Commit: `feat(ui): initialize Next.js frontend project`
**Done when**: `npm run dev` serves the app on localhost
**Blocked by**: Nothing (can start early)
**Can parallelize with**: Phase 2, 3, 4

### Task 6.2: API Proxy Route
**Files**: Create `frontend/app/api/chat/route.ts`
**Steps**:
1. Implement `POST /api/chat` that proxies to `${KIBANA_URL}/api/agent_builder/converse`
2. Pass `input`, `agent_id`, `conversation_id`
3. Handle errors (429 rate limit, 500 server error)
4. Commit: `feat(ui): add API proxy route for Agent Builder`
**Done when**: Sending a POST to `/api/chat` returns agent response
**Blocked by**: Task 6.1
**Can parallelize with**: Task 6.3

### Task 6.3: Chat Components
**Files**: Create components in `frontend/components/`
**Steps**:
1. `ChatMessage.tsx` -- Message bubble with agent identity (name, color, avatar)
2. `QueryDetails.tsx` -- Collapsible panel showing ES|QL queries
3. `AgentStatus.tsx` -- Shows which agent is investigating
4. `RemediationPanel.tsx` -- Approve/override remediation actions
5. `IncidentTimeline.tsx` -- Visual timeline of events
6. Dark theme styling (SRE dashboard aesthetic)
7. Commit: `feat(ui): add chat components with ES|QL query display`
**Done when**: Chat interface renders messages with agent colors, collapsible queries, and remediation buttons
**Blocked by**: Task 6.1
**Can parallelize with**: Task 6.2

### Task 6.4: Integration & Polish
**Files**: Modify `frontend/app/page.tsx` and components
**Steps**:
1. Wire up all components into main chat page
2. Add conversation context (conversation_id persistence)
3. Add loading states, error states, retry logic
4. Test full flow: type "Investigate: payment-service alerts firing" and watch investigation
5. Commit: `feat(ui): complete chat UI integration`
**Done when**: Full investigation visible in chat UI with ES|QL queries shown per finding
**Blocked by**: Tasks 6.2, 6.3, Phase 4 (agents must exist)
**Can parallelize with**: Nothing

---

## Phase 7: End-to-End Testing & Polish
**Review checkpoint**: Full demo scenario works from chat UI with investigation + remediation + incident report.

### Task 7.1: Full Demo Scenario Test
**Steps**:
1. Open chat UI
2. Type: "ALERT: payment-service returning 500 errors. Multiple alerts firing: error_rate_high, latency_spike, suspicious_login_attempts. Investigate and remediate."
3. Verify investigation identifies: error spike, CPU anomaly, deployment correlation, brute-force attack
4. Verify remediation executes: Slack notify + incident report (minimum 2 workflows)
5. Check `incidents-incident-cortex` for indexed report
6. Check `incident-cortex-notifications` for notification docs
**Done when**: All 4 findings identified, at least 2 remediation actions executed, incident report stored
**Blocked by**: All previous phases
**Can parallelize with**: Nothing

### Task 7.2: Fix Issues & Iterate
**Steps**:
1. Fix ES|QL query syntax errors discovered during testing
2. Refine agent prompts if tools aren't selected correctly
3. Improve tool descriptions if LLM misinterprets purpose
4. Ensure Chat UI renders all response types correctly
5. Commit fixes as needed
**Done when**: Demo scenario completes reliably 3 times in a row
**Blocked by**: Task 7.1
**Can parallelize with**: Nothing

---

## Phase 8: Documentation & Submission
**Review checkpoint**: README complete, video recorded, Devpost submitted.

### Task 8.1: README & Architecture Diagram
**Files**: Modify `README.md`, create `docs/architecture.png` or ASCII
**Steps**:
1. Write README: title, one-liner, architecture diagram, setup instructions, tech stack, team
2. Include setup instructions: clone, create .env, run setup scripts
3. Add screenshots of chat UI investigation
4. Commit: `docs: add comprehensive README with architecture diagram`
**Done when**: README is complete and informative for judges
**Blocked by**: Phase 7
**Can parallelize with**: Task 8.2

### Task 8.2: Demo Video (3 minutes)
**Steps**:
1. Follow demo script: Problem (0:00-0:30) -> Investigation (0:30-1:30) -> Remediation (1:30-2:15) -> Report+MCP (2:15-2:45) -> Impact (2:45-3:00)
2. Record with OBS or Loom
3. Upload to YouTube (public or unlisted)
**Done when**: Video uploaded, URL available
**Blocked by**: Phase 7
**Can parallelize with**: Task 8.1

### Task 8.3: Social Media Post
**Steps**:
1. Post on X/Twitter with @elastic_devs tag
2. Include screenshot and repo link
3. Save post URL for submission
**Done when**: Post published
**Blocked by**: Task 8.1 (need repo link)
**Can parallelize with**: Task 8.2

### Task 8.4: Devpost Submission
**Steps**:
1. Fill all required fields on Devpost
2. Add video URL, repo URL, social post URL
3. Write 400-word description: problem, solution, features used, what we liked, challenges
4. Submit before Feb 27 @ 1pm EST
**Done when**: Submission confirmed on Devpost
**Blocked by**: Tasks 8.1, 8.2, 8.3
**Can parallelize with**: Nothing

---

## Quick Reference: Parallelization Map

```
Phase 1 (Foundation)     [SEQUENTIAL] 1.1 -> 1.2 -> 1.3
                              |
              +---------------+---------------+
              |                               |
Phase 2 (Tools)              Phase 3 (Workflows)    Phase 6.1 (UI Setup)
  2.1 -> 2.2 -> 2.3          3.1 -> 3.2             6.1 -> 6.2 + 6.3
              |                    |                       |
              +--------------------+                       |
                      |                                    |
Phase 4 (Agents)      |                                    |
  4.1 -> 4.2 -> 4.3  |                                    |
              |       |                                    |
    +---------+-------+                                    |
    |                 |                                    |
Phase 5.1 (A2A)  Phase 5.2 (MCP)                          |
    |                 |                                    |
    +---------+-------+------------------------------------+
              |
Phase 6.4 (UI Integration)
              |
Phase 7 (E2E Testing)
  7.1 -> 7.2
              |
Phase 8 (Docs & Submit)
  8.1 + 8.2 + 8.3 -> 8.4
```

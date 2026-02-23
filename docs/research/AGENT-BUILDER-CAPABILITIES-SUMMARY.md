# Elasticsearch Agent Builder: Comprehensive Technical Capabilities Summary

## 1. KEY TECHNICAL CAPABILITIES

### Architecture: Three-Tier System
Agent Builder is a framework for building context-driven AI agents on top of Elasticsearch. It operates as three layers:

- **ES|QL Query Layer** -- Parameterized queries that encapsulate expert business logic. Parameters like `?time_duration` act as guardrails, forcing LLMs to work within tested, correct queries rather than generating arbitrary ones.
- **Tools Layer** -- Reusable, modular functions (atomic operations) with defined signatures that agents call. Each tool has a unique ID, natural language description, configuration (ES|QL query + parameters), and labels.
- **Agent Layer** -- LLM-powered personas with custom instructions (system prompts), curated tool assignments, and configurable LLM provider.

### Execution Flow
1. **Understand** -- Deconstruct user intent from natural language
2. **Plan** -- Match intent to available tools via description alignment
3. **Execute** -- Invoke selected tool(s) with parameterized values
4. **Synthesize** -- Format raw results into human-readable responses (markdown)

### Core Platform Strengths
- **Elasticsearch-native search** -- Vector, hybrid, and semantic search built in. ELSER and Elastic Rerank for relevance.
- **ES|QL LOOKUP JOIN** -- Chain joins across multiple indices by common keys WITHOUT denormalization (e.g., news sentiment -> asset details -> client holdings -> accounts).
- **Context Engineering** -- System designed to get the right tools and context to agents, not just prompt-and-pray.
- **Security** -- Data never leaves your infrastructure. Tool access is scoped per agent. Permissions and API key controls.
- **Model Flexibility** -- Any LLM provider (OpenAI, Azure OpenAI, Amazon Bedrock, Google Vertex, local LLMs via Elastic Inference Server).
- **Serverless** -- Available on Elastic Cloud Serverless (free 2-week trial for hackathon).

### Programmatic Access (Three Core APIs)
- `POST /api/agent_builder/tools` -- CRUD for tools
- `POST /api/agent_builder/agents` -- Agent definition and tool assignment
- `POST /api/agent_builder/converse` -- Chat interface returning full thinking/reasoning steps

### Integration Protocols
- **MCP Server** -- Expose all Agent Builder tools to external MCP clients (Claude Desktop, Cursor, VS Code, custom apps). Copy MCP URL from Kibana UI.
- **A2A Server** -- Agent-to-Agent protocol for inter-agent communication.
- **Kibana REST APIs** -- Full programmatic control over agents, tools, conversations.
- **Elastic Workflows** -- Bidirectional: agents trigger workflows, workflows invoke agents.

---

## 2. AVAILABLE TOOLS IN DETAIL

### Built-in Tools (Ready Out of Box, Cannot Be Modified)
- **Search tool** -- Iterates to find the right index, understand its structure, formulate effective queries automatically.
- **ES|QL execution** -- Transforms natural language into piped, multi-step ES|QL queries. Supports analytical queries and hybrid semantic search.
- **Index explorer** -- Identifies which indices are relevant, reducing noise and cost.
- **Index listing** -- Lists available indices on the cluster.
- **Mapping understanding** -- Reads and interprets index mappings.

### Custom Tool Types

#### ES|QL Tools
- Define explicit ES|QL queries with guarded parameters
- Parameters automatically inferred via "Infer parameters from query" button in UI
- Support LOOKUP JOIN for multi-index correlation
- Example: `find_client_exposure_to_negative_news` with `?time_duration` parameter

#### Index Search Tools
- Scope search to specific indices with enhanced LLM context
- Semantic search on `semantic_text` fields
- Reranking via `.rerank-v1-elasticsearch` inference
- Hybrid search combining keyword + vector approaches

#### MCP Tools (Import External)
- Import tools from any external MCP server
- Add MCP server URL to agent configuration
- Enables external API access (GitHub, Slack, etc.)

#### Workflow Tools
- Trigger Elastic Workflows from agents
- Workflows can execute HTTP requests, Elasticsearch operations, conditional logic
- Typed inputs, secure credential handling via `{{ secrets.* }}`
- Steps: Elasticsearch create/index/search, Kibana actions, External HTTP calls
- Flow control: If/Foreach/Wait
- Triggers: Manual, Scheduled, Alert-based

---

## 3. WHAT THE EXAMPLE AGENTS DEMONSTRATE

### Example 1: Financial Portfolio Risk Agent (Walkthrough Blog)
- **Domain**: Financial services
- **Capability**: Multi-index correlation using LOOKUP JOIN (news -> assets -> holdings -> accounts)
- **Demonstrates**: Parameterized ES|QL as guardrails, custom tool creation, agent persona definition
- **Key Takeaway**: Shows how business logic is encoded in queries, not in prompts

### Example 2: Augmented Infrastructure Agent
- **Domain**: DevOps/Security/Cloud
- **Capability**: Agent that actually TOUCHES infrastructure (not just chat)
- **Architecture**: Distributed "runners" deployed in target environments (servers, K8s, AWS) with MCP tools
- **Demonstrates**:
  - Auto-deploying K8s observability (OpenTelemetry Operator) without user writing YAML
  - AWS security auditing: finding exposed endpoints, deploying XDR/CDR
  - Distributed tool execution via Workflows (writing requests to Elasticsearch indices)
  - Dynamic capability discovery (ES|QL search for runner capabilities)
- **Key Takeaway**: Breaks the "Call Center paradigm" -- agents that execute, not just advise

### Example 3: Voice Agent (ElasticSport)
- **Domain**: E-commerce/Customer Support
- **Architecture**: LiveKit pipeline (STT -> Agent Builder -> TTS)
- **Demonstrates**:
  - Real-time voice interaction with product catalog (semantic search)
  - Knowledge base Q&A via voice
  - Order lookup by ID
  - Triggering SMS via Twilio workflow during calls
  - Voice-specific prompt engineering
- **Key Takeaway**: Agent Builder as the reasoning core in a voice pipeline, not just text chat

### Example 4: IT Provisioning Workflow Agent
- **Domain**: IT Operations
- **Architecture**: Agent Builder (conversation) -> Workflows (automation) -> ServiceNow (system of record)
- **Demonstrates**:
  - Phased conversational data collection (slot filling)
  - JSON output formatting for automation compatibility
  - Multi-step HTTP integration with ServiceNow (asset lookup, catalog ordering)
  - Audit trail in Elasticsearch
  - Policy enforcement (e.g., laptop age check)
- **Key Takeaway**: Agent as the conversational frontend to complex multi-system automation

---

## 4. TECHNICALLY IMPRESSIVE VS. BASIC

### BASIC (What Everyone Will Do)
- Single agent with default tools chatting about data in one index
- Simple Q&A over a knowledge base (just semantic search)
- Basic ES|QL tool that runs a pre-written query
- Using only the Kibana chat UI, no external integration
- Single-turn interactions without follow-up reasoning

### INTERMEDIATE (Solid but Expected)
- Custom agent with multiple custom ES|QL tools
- Multi-index correlation using LOOKUP JOIN
- MCP integration with one external client (Claude Desktop)
- Simple workflow trigger (e.g., send email/Slack notification)
- Custom prompt engineering with persona definition

### TECHNICALLY IMPRESSIVE (What Wins)
- **Multi-agent orchestration**: Different agents plan, execute, review, and verify work (A2A protocol)
- **Bidirectional workflow integration**: Agents trigger workflows AND workflows invoke agents in a loop
- **Infrastructure actuation**: Agents that don't just advise but actually deploy, fix, or modify systems (the "Augmented Infrastructure" pattern)
- **Voice/multimodal interface**: LiveKit voice pipeline or other non-chat interface
- **Time-series anomaly detection + automated response**: Agent detects anomalies in metrics/logs and triggers remediation workflows
- **Cross-system glue**: Agent connecting 3+ systems that don't normally integrate (e.g., CRM + GitHub + CI/CD + monitoring)
- **Distributed execution**: Runner pattern with MCP tools deployed across multiple environments
- **Real-time streaming**: Processing live data feeds and taking action
- **Custom MCP server exposing Agent Builder to novel clients**: Build your own MCP client that uses Agent Builder tools
- **Measurable impact demonstration**: Clear before/after metrics showing time saved, steps removed, errors reduced

### JUDGING CRITERIA (from hackathon rules)
- Technical Execution: 30% -- Quality code, functional, leverages Agent Builder + Elasticsearch
- Potential Impact & Wow Factor: 30% -- How useful, how significant the problem, how novel
- Demo: 30% -- Clear problem definition, effective presentation, architecture diagram
- Social: 10% -- Shared on social channels with proof

---

## 5. GAPS AND OPPORTUNITIES THE EXAMPLES DON'T COVER

### Unexplored Domains
- **Healthcare**: Patient record search, clinical decision support, appointment scheduling agent
- **Legal**: Contract analysis, compliance checking, case research across legal databases
- **Education**: Personalized tutoring agent that searches course materials and student progress
- **Supply Chain/Logistics**: Inventory optimization, shipping anomaly detection, geo-aware routing
- **Marketing/Sales**: Campaign performance analysis, lead scoring across CRM data, content recommendations
- **Real Estate**: Property matching, market analysis combining listings + demographics + crime data

### Unexplored Technical Patterns
- **Alert-triggered agents**: Using Elastic alerting rules to trigger agent workflows (alert triggers exist in Workflows but no example shows this end-to-end)
- **Geospatial agents**: No example uses Elasticsearch's geo capabilities (geo_point, geo_shape) for location-aware reasoning
- **Anomaly detection integration**: No example combines ML anomaly detection jobs with agent reasoning
- **Multi-tenant agents**: Agents that serve different users with different permission scopes
- **Agent memory/persistence**: Long-running agents that remember context across sessions
- **Batch/scheduled agent execution**: Workflows triggering agents on a schedule for automated reporting
- **Embedding agents in existing tools**: Slack bot, email responder, IDE plugin (mentioned as inspiration but no example built)
- **Data pipeline agents**: Agents that monitor and manage ingest pipelines, data quality, schema evolution
- **Security-focused agents**: SIEM/SOAR-style agent that triages alerts, enriches IOCs, recommends playbooks
- **Multi-language/i18n agents**: Voice or text agents handling multiple languages

### Unexplored Integration Patterns
- **A2A (Agent-to-Agent)**: Documented as available but NO example blog post shows A2A in action. This is a huge opportunity.
- **Scheduled workflow -> agent -> action loop**: No example shows a fully autonomous scheduled agent
- **Custom MCP server creation**: Examples only show consuming MCP, not building novel MCP servers that expose Agent Builder
- **Multiple LLM providers in one agent system**: Using different models for different tasks (fast model for triage, reasoning model for analysis)
- **Combining Agent Builder with Elastic ML jobs**: Feeding anomaly detection results into agent reasoning

### Production Gaps
- **Error handling and fallback strategies**: No example shows robust error handling in multi-step flows
- **Testing and validation frameworks**: No example shows how to test agent behavior systematically
- **Monitoring agent performance**: Token usage monitoring exists but no example shows quality monitoring
- **Rate limiting and cost control**: Important for production but not demonstrated

---

## KEY TECHNICAL CONSTRAINTS

- Available on Elastic Cloud Serverless and Elastic Cloud Hosted (9.3+ GA)
- 2-week free trial for hackathon (no extensions)
- Requires LLM connector configuration (OpenAI, Azure, Bedrock, Vertex, or local)
- ES|QL is the primary query language for custom tools (not Query DSL directly)
- Workflows engine is separately enabled and uses YAML-style definitions
- MCP server URL needs to be copied from Kibana Tools page
- Built-in tools cannot be modified or deleted

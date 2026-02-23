# Blog Scrape: Agent Builder & Workflows Integration
Source: https://www.elastic.co/search-labs/blog/agent-builder-one-workflow

## Architecture Overview

Three distinct layers:
1. **Interaction layer**: Agent Builder for natural language processing
2. **Automation layer**: Workflows for execution logic
3. **System of record**: External system (e.g., ServiceNow) for data persistence

## Agent Builder Configuration

### Intent Detection & Scope
Agents use system prompts with explicit MISSION statements constraining the agent to specific tasks (e.g., IT provisioning only).

### Slot Filling (Phased Data Collection)
DATA COLLECTION STRATEGY breaks required data into logical phases to prevent context switching fatigue. Enforces immediate validation before advancing.

### Output Formatting
Agents structure collected data as JSON payloads matching automation expectations. Explicit instructions ensure output matches what the automation layer expects.

## Workflows: Automation Layer

### Workflow Inputs (Typed Parameters)
```
- name: userid (string)
- name: preferred-address (string)
- name: laptop-choice (default: "Macbook latest", string)
- name: laptop-keep-or-return (default: "return", string)
```

### HTTP Integration Steps
1. **Asset Lookup**: Query ServiceNow's `cmdb_ci_computer` table
2. **Service Catalog Operations**: Programmatically add items to cart via ServiceNow API
3. **Data Persistence**: `elasticsearch.index` step stores request details

### Credential Management
Secure variable handling via `{{ secrets.servicenow_creds }}` placeholders.

## Execution Flow

User -> Agent Builder (conversational data collection) -> JSON trigger -> Workflow (multi-step HTTP calls to ServiceNow) -> Elasticsearch (audit trail indexing)

## Key Capabilities

- **Policy Enforcement**: Business logic like "Is the laptop > 3 years old?" before approval
- **Multi-Step Orchestration**: Single workflow coordinates multiple API calls with state maintenance
- **Audit Trail Creation**: Elasticsearch captures request metadata alongside external ticket creation

Reduces traditional 5-10 minute form processes into conversational interactions.

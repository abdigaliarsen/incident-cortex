# Blog Scrape: AI Agent Builder Elasticsearch Walkthrough
Source: https://www.elastic.co/search-labs/blog/ai-agent-builder-elasticsearch

## Core Architecture

The Agent Builder operates as a three-tier system combining business logic, skills, and intelligence:

1. **ES|QL Query Layer**: Foundation containing parameterized queries that encapsulate expert knowledge
2. **Tools Layer**: Reusable skills that wrap queries with natural language descriptions
3. **Agent Layer**: LLM-powered persona with instructions and assigned tools

## Key Technical Components

### ES|QL & LOOKUP JOIN
The system leverages ES|QL's "LOOKUP JOIN" capability to enable chaining joins across multiple indices based on common keys. In the financial example, three sequential joins correlate news sentiment -> asset details -> client holdings -> account information without denormalization.

### Parameterized Queries as Guardrails
Parameters like `?time_duration` function as safety constraints, forcing LLMs to work within tested, efficient, and correct business logic that a human expert has already defined rather than generating arbitrary queries.

### Tool Definition Structure
Tools require:
- **Tool ID**: Unique identifier (e.g., `find_client_exposure_to_negative_news`)
- **Description**: Natural language bridge connecting user intent to query logic
- **Configuration**: Full ES|QL query with parameter definitions
- **Labels**: Categorization tags for grouping related tools

### Agent Configuration
Agents combine:
- **Instructions**: Prompt defining persona, reasoning framework, and constraints
- **Tool Assignment**: Curated subset of available tools with permission controls
- **LLM Integration**: Interface with generative AI providers

## API Endpoints

Three core REST endpoints power programmatic access:

- **`/api/agent_builder/tools`**: CRUD operations for skill management
- **`/api/agent_builder/agents`**: Agent persona definition and tool assignments
- **`/api/agent_builder/converse`**: Conversational interface for querying agents

## Reasoning & Execution Flow

Agents execute queries through a four-step process:

1. **Understand**: Deconstruct user intent from natural language
2. **Plan**: Identify matching tools based on query/description alignment
3. **Execute**: Invoke selected tool with parameterized values
4. **Synthesize**: Format raw results into human-readable markdown responses

## UI & Developer Paths

**Kibana UI**: Navigate to Agents -> Tools/Manage Tools -> New Tool, fill form, click "Infer parameters from query" for automatic parameter detection, then "Save & test" with JSON response validation.

**API Path**: POST requests to endpoints with complete tool/agent definitions enable CI/CD integration and programmatic agent management.

## Practical Capabilities

- Multi-index correlation without physical denormalization
- Parameter templating for safe LLM operation
- Custom prompt engineering for domain-specific behavior
- Markdown-formatted output with structured data presentation
- Interactive follow-up conversations within single session

## Example Domain Applications

Beyond finance (portfolio risk analysis), the architecture supports cybersecurity threat hunting, SRE incident diagnosis, and marketing campaign optimization.

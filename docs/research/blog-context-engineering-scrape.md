# Blog Scrape: Elastic AI Agent Builder Context Engineering Introduction
Source: https://www.elastic.co/search-labs/blog/elastic-ai-agent-builder-context-engineering-introduction

## Core Concept

Agent Builder implements "context engineering" -- a system to get the right tools and context to agents so they provide accurate answers and take reliable actions. Addresses the challenge of handling internal, often messy data beyond simple LLM pass-through.

## Built-in Capabilities

### Native Conversational Agent
Immediate access to Elasticsearch data through Kibana and API interfaces without custom configuration.

### Intelligent Tools

**Search tool**: Iterates through steps to identify the right index, understand index structure, formulate the most effective queries.

**ES|QL execution**: Transforms natural language into intuitive, piped, multi-step ES|QL. Enables analytical and hybrid semantic search.

**Index explorer**: Helps agents identify which indices to work with, reducing noise and cost.

## Custom Tool Development

Two approaches:
1. **Index Search tools**: Scope capabilities to specific indices with enhanced LLM context
2. **ES|QL tools**: Define explicit queries with guarded parameters (e.g., `?time_duration`) for secure, constrained inputs

Tools support LOOKUP JOIN operations for multi-index correlation.

## Custom Agent Configuration

- Custom system prompts defining persona and behavior
- Configurable tool access (selective assignment for security)
- Security profiles meeting specific requirements

## Integration Points

### APIs (Three Core Endpoints)
- `/api/agent_builder/tools`: Tool management
- `/api/agent_builder/agents`: Agent definition
- `/api/agent_builder/converse`: Chat interaction returning full thinking/reasoning steps

### MCP (Model Context Protocol)
Native integration exposing built-in and custom tools for external MCP clients (Claude Desktop, Cursor, VS Code).

### A2A (Agent-to-Agent)
Framework for inter-agent communication.

## Additional Technical Features

- Built-in visualizations with editable chart types and dashboard integration
- Full agent tracing with query result inspection in Discover
- Model flexibility supporting any LLM provider
- Logging capabilities (coming soon)

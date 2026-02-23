# Blog Scrape: Agent Builder Augmented Infrastructure
Source: https://www.elastic.co/search-labs/blog/agent-builder-augmented-infrastructure

## What It Does

An infrastructure copilot that not only gives advice but also creates, deploys, monitors, and fixes live environments. Overcomes the limitation that most agents are trapped in the "Call Center paradigm" -- they can read, think, and chat, but cannot reach out and touch the infrastructure.

## Core Architecture

Three-component design:

1. **Augmented Infrastructure Runners** - Lightweight executable agents deployed within target environments (servers, K8s clusters, cloud accounts) with secured direct connections to Elasticsearch
2. **Elastic Agent Builder** - The LLM orchestration framework bridging Google Gemini and private Elasticsearch data
3. **Workflow Layer** - Elasticsearch-based job distribution system

## Technical Implementation Evolution

### Iteration 1 (Python polling)
Python project with a `while(true)` loop querying the Elastic Agent Builder conversations API every second, checking for tool invocation syntax in JSON format.

Problems: Conversation clutter from JSON payloads and API latency.

### Iteration 2 (call_external_tool)
Used `call_external_tool` function. Results bypassed conversations and written directly to Elasticsearch indices.

### Final Architecture (Workflows Integration)
Elastic Workflows handle distributed tool requests:

```yaml
name: ai-tool-call
enabled: true
triggers:
  - type: manual
inputs:
  - name: runner_id
    type: string
  - name: tool_calls
    type: string
steps:
  - name: store_request
    type: elasticsearch.create
    with:
      index: distributed-tool-requests
      id: "{{inputs.runner_id}}_{{ execution.id }}"
      document:
        request_id: "{{ execution.id }}"
        runner_id: "{{inputs.runner_id}}"
        tool_call: "{{inputs.tool_calls}}"
        status: "unhandled"
```

## Demonstrated Use Cases

**DevOps Scenario**: Agent automatically identified Kubernetes clusters, created namespaces, generated secrets, installed the OpenTelemetry Operator, and linked to live APM dashboards. Full K8s observability without writing a single line of YAML.

**Security Scenario**: Enumerated AWS resources, identified EC2 instances and EKS clusters with exposed endpoints, deployed Elastic Security XDR and CDR with operator approval.

## Extensibility

- Augmented synthetics - Diagnosing TLS errors across global runners
- Augmented development - Creating pull requests, implementing CAPTCHAs
- Augmented operations - Dynamically reconfiguring DNS during outages

## Key Dependencies

- FastMCP - Most popular MCP server framework for Python
- Google Gemini - LLM powering the agent
- Elasticsearch/ES|QL - Data storage and query language
- GitHub: strawgate/augmented-infrastructure

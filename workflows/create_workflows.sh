#!/usr/bin/env bash
set -e

# ============================================================
# Create Elastic Workflows for Incident Cortex remediation
#
# This script:
# 1. Reads workflow YAML definitions from workflows/*.yml
# 2. Attempts to create workflows via Kibana Workflows API
# 3. Falls back to creating workflow-type tools in Agent Builder
# 4. If workflow tools fail (workflow not found), prints guidance
#    for manual workflow creation in Kibana UI
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Source environment variables
if [ -f "${ROOT_DIR}/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "${ROOT_DIR}/.env"
    set +a
else
    echo "ERROR: .env file not found at ${ROOT_DIR}/.env"
    exit 1
fi

if [ -z "${KIBANA_URL}" ] || [ -z "${API_KEY}" ]; then
    echo "ERROR: KIBANA_URL and API_KEY must be set in .env"
    exit 1
fi

echo "=== Incident Cortex: Workflow Creation ==="
echo "Kibana URL: ${KIBANA_URL}"
echo ""

# Track results
WORKFLOWS_CREATED=0
WORKFLOW_TOOLS_CREATED=0
WORKFLOW_TOOLS_FAILED=0

# ============================================================
# Step 1: Attempt to create workflows via Workflows API
# ============================================================
echo "--- Step 1: Attempting workflow creation via Workflows API ---"

WORKFLOW_API_AVAILABLE=false
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "${KIBANA_URL}/api/workflows" \
    -H "Authorization: ApiKey ${API_KEY}" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" 2>/dev/null || echo "000")

if [ "${HTTP_CODE}" = "200" ]; then
    WORKFLOW_API_AVAILABLE=true
    echo "  Workflows API is available (HTTP ${HTTP_CODE})"
else
    echo "  WARNING: Workflows API returned HTTP ${HTTP_CODE}"
    echo "  Workflows API is NOT available via REST on this Serverless instance."
    echo "  Workflow YAML files are saved for manual creation in Kibana UI."
    echo ""
fi

# ============================================================
# Step 2: Define workflow tool configurations
# ============================================================
echo "--- Step 2: Creating workflow-type tools in Agent Builder ---"
echo ""

# Workflow tool definitions: id, description, workflow_id, tags
declare -A WORKFLOW_TOOLS
WORKFLOW_TOOLS=(
    ["ic-notify-slack"]='{"id":"ic-notify-slack","type":"workflow","description":"Send incident notification to Slack channel (simulated via Elasticsearch index). Use this to alert the team about incidents. Provide incident_summary, severity (P1-P4), and channel name.","tags":["incident-cortex","remediation","notification"],"configuration":{"workflow_id":"notify-slack"}}'
    ["ic-create-jira-ticket"]='{"id":"ic-create-jira-ticket","type":"workflow","description":"Create a Jira ticket for incident tracking (simulated via Elasticsearch index). Use this to create tracking tickets. Provide title, description, severity (P1-P4), and assignee.","tags":["incident-cortex","remediation","ticketing"],"configuration":{"workflow_id":"create-jira-ticket"}}'
    ["ic-rollback-deployment"]='{"id":"ic-rollback-deployment","type":"workflow","description":"Rollback a service deployment to a previous version (simulated via Elasticsearch index). Use when a bad deployment is identified as root cause. Provide service name, from_version, and to_version.","tags":["incident-cortex","remediation","deployment"],"configuration":{"workflow_id":"rollback-deployment"}}'
    ["ic-block-ip"]='{"id":"ic-block-ip","type":"workflow","description":"Block a suspicious IP address (simulated via Elasticsearch index). Use for security remediation when malicious IP is identified. Provide ip_address, reason, and duration (e.g. 24h, permanent).","tags":["incident-cortex","remediation","security"],"configuration":{"workflow_id":"block-ip"}}'
    ["ic-index-incident-report"]='{"id":"ic-index-incident-report","type":"workflow","description":"Store a completed incident report in Elasticsearch. Use after investigation is complete. Provide incident_id, title, root_cause, severity (P1-P4), and remediation_actions taken.","tags":["incident-cortex","remediation","reporting"],"configuration":{"workflow_id":"index-incident-report"}}'
)

for tool_id in ic-notify-slack ic-create-jira-ticket ic-rollback-deployment ic-block-ip ic-index-incident-report; do
    payload="${WORKFLOW_TOOLS[$tool_id]}"
    echo "  Creating workflow tool: ${tool_id}"

    # First try to delete if it already exists (idempotent)
    curl -s -o /dev/null -w "" \
        -X DELETE "${KIBANA_URL}/api/agent_builder/tools/${tool_id}" \
        -H "Authorization: ApiKey ${API_KEY}" \
        -H "kbn-xsrf: true" 2>/dev/null || true

    # Create the tool
    RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST "${KIBANA_URL}/api/agent_builder/tools" \
        -H "Authorization: ApiKey ${API_KEY}" \
        -H "kbn-xsrf: true" \
        -H "Content-Type: application/json" \
        -d "${payload}" 2>/dev/null)

    HTTP_BODY=$(echo "${RESPONSE}" | head -n -1)
    HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)

    if [ "${HTTP_CODE}" = "200" ] || [ "${HTTP_CODE}" = "201" ]; then
        echo "    OK (HTTP ${HTTP_CODE})"
        WORKFLOW_TOOLS_CREATED=$((WORKFLOW_TOOLS_CREATED + 1))
    else
        echo "    FAILED (HTTP ${HTTP_CODE}): ${HTTP_BODY}"
        WORKFLOW_TOOLS_FAILED=$((WORKFLOW_TOOLS_FAILED + 1))
    fi
done

echo ""

# ============================================================
# Step 3: Summary and guidance
# ============================================================
echo "=== Summary ==="
echo "  Workflow YAML files: 5 (saved in workflows/)"
echo "  Workflow tools created: ${WORKFLOW_TOOLS_CREATED}"
echo "  Workflow tools failed: ${WORKFLOW_TOOLS_FAILED}"
echo ""

if [ "${WORKFLOW_TOOLS_FAILED}" -gt 0 ]; then
    echo "=== MANUAL STEPS REQUIRED ==="
    echo ""
    echo "The workflow-type tools could not be created because the referenced"
    echo "workflows do not yet exist. Workflows must be created manually in"
    echo "the Kibana UI first."
    echo ""
    echo "Steps to complete setup:"
    echo ""
    echo "1. Go to: ${KIBANA_URL}/app/management/kibana/workflows"
    echo "   (or navigate to Stack Management > Workflows)"
    echo ""
    echo "2. For each .yml file in workflows/, create a new workflow:"
    echo "   - Click 'Create workflow'"
    echo "   - Paste the YAML content from each file"
    echo "   - Save the workflow"
    echo ""
    echo "   Workflow files to create:"
    for yml_file in "${ROOT_DIR}"/workflows/*.yml; do
        if [ -f "${yml_file}" ]; then
            name=$(basename "${yml_file}" .yml)
            echo "     - ${name} (from ${yml_file})"
        fi
    done
    echo ""
    echo "3. After creating workflows in UI, re-run this script to create"
    echo "   the workflow tools that reference them."
    echo ""
fi

# ============================================================
# Step 4: Verify tools
# ============================================================
echo "--- Verifying tools ---"
TOOL_LIST=$(curl -s \
    -X GET "${KIBANA_URL}/api/agent_builder/tools" \
    -H "Authorization: ApiKey ${API_KEY}" \
    -H "kbn-xsrf: true" 2>/dev/null)

# Count workflow tools using python for reliable JSON parsing
WORKFLOW_COUNT=$(echo "${TOOL_LIST}" | python3 -c '
import json, sys
data = json.load(sys.stdin)
tools = data.get("results", data) if isinstance(data, dict) else data
wf = [t for t in tools if t.get("type") == "workflow"]
print(len(wf))
' 2>/dev/null || echo "0")

echo "  Workflow tools in Agent Builder: ${WORKFLOW_COUNT}"

if [ "${WORKFLOW_COUNT}" -ge 2 ]; then
    echo "  PASS: At least 2 workflow tools exist"
else
    echo "  NOTE: Fewer than 2 workflow tools. See manual steps above."
fi

echo ""
echo "=== Done ==="

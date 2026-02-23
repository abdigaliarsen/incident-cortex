#!/bin/bash
# Create all 10 ES|QL custom tools in Elastic Agent Builder.
# Handles existing tools by deleting and re-creating them.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Source environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
  source "$PROJECT_ROOT/.env"
elif [ -f ".env" ]; then
  source ".env"
else
  echo "ERROR: .env file not found"
  exit 1
fi

TOOL_DEFS="$SCRIPT_DIR/tool_definitions.json"
if [ ! -f "$TOOL_DEFS" ]; then
  echo "ERROR: tool_definitions.json not found at $TOOL_DEFS"
  exit 1
fi

TOOL_COUNT=$(python3 -c "import json; print(len(json.load(open('$TOOL_DEFS'))))")
echo "Found $TOOL_COUNT tool definitions in tool_definitions.json"
echo "---"

SUCCESS=0
FAILED=0

for i in $(seq 0 $((TOOL_COUNT - 1))); do
  TOOL=$(python3 -c "import json; print(json.dumps(json.load(open('$TOOL_DEFS'))[$i]))")
  TOOL_ID=$(python3 -c "import json; print(json.load(open('$TOOL_DEFS'))[$i]['id'])")

  echo -n "Creating tool: $TOOL_ID ... "

  # Try to create the tool
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${KIBANA_URL}/api/agent_builder/tools" \
    -H "Authorization: ApiKey ${API_KEY}" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    -d "$TOOL")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" = "200" ]; then
    echo "CREATED"
    SUCCESS=$((SUCCESS + 1))
  elif echo "$BODY" | grep -q "already exists"; then
    echo -n "EXISTS, re-creating ... "
    # Delete existing tool
    curl -s -X DELETE "${KIBANA_URL}/api/agent_builder/tools/${TOOL_ID}" \
      -H "Authorization: ApiKey ${API_KEY}" \
      -H "kbn-xsrf: true" > /dev/null

    # Re-create
    RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "${KIBANA_URL}/api/agent_builder/tools" \
      -H "Authorization: ApiKey ${API_KEY}" \
      -H "kbn-xsrf: true" \
      -H "Content-Type: application/json" \
      -d "$TOOL")

    HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)

    if [ "$HTTP_CODE2" = "200" ]; then
      echo "UPDATED"
      SUCCESS=$((SUCCESS + 1))
    else
      BODY2=$(echo "$RESPONSE2" | sed '$d')
      echo "FAILED: $BODY2"
      FAILED=$((FAILED + 1))
    fi
  else
    echo "FAILED ($HTTP_CODE): $BODY"
    FAILED=$((FAILED + 1))
  fi
done

echo "---"
echo "Results: $SUCCESS succeeded, $FAILED failed"
echo ""

# Verify all ic-* tools exist
echo "Verifying ic-* tools in Agent Builder..."
IC_TOOLS=$(curl -s -H "Authorization: ApiKey ${API_KEY}" -H "kbn-xsrf: true" \
  "${KIBANA_URL}/api/agent_builder/tools" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
tools = data.get('results', data)
ic_tools = [t['id'] for t in tools if t['id'].startswith('ic-')]
for t in sorted(ic_tools):
    print(f'  {t}')
print(f'Total ic-* tools: {len(ic_tools)}')
")

echo "$IC_TOOLS"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "WARNING: $FAILED tools failed to create!"
  exit 1
fi

echo ""
echo "All $SUCCESS tools created successfully!"

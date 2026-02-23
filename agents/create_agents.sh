#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

set -a
source "$PROJECT_DIR/.env"
set +a

AGENTS_FILE="$SCRIPT_DIR/agent_definitions.json"
AGENT_COUNT=$(python3 -c "import json; print(len(json.load(open('$AGENTS_FILE'))))")

echo "=== Creating $AGENT_COUNT Agents ==="

CREATED=0
FAILED=0

for i in $(seq 0 $((AGENT_COUNT - 1))); do
    AGENT=$(python3 -c "import json; print(json.dumps(json.load(open('$AGENTS_FILE'))[$i]))")
    AGENT_ID=$(echo "$AGENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

    echo -n "  Creating $AGENT_ID... "

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
        "$KIBANA_URL/api/agent_builder/agents" \
        -H "Authorization: ApiKey $API_KEY" \
        -H "kbn-xsrf: true" \
        -H "Content-Type: application/json" \
        -d "$AGENT")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo "OK"
        CREATED=$((CREATED + 1))
    elif [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "409" ]; then
        # Agent may already exist — try DELETE + re-POST
        echo -n "EXISTS, updating... "
        DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
            "$KIBANA_URL/api/agent_builder/agents/$AGENT_ID" \
            -H "Authorization: ApiKey $API_KEY" \
            -H "kbn-xsrf: true")

        if [ "$DEL_CODE" = "200" ] || [ "$DEL_CODE" = "204" ]; then
            RETRY=$(curl -s -w "\n%{http_code}" -X POST \
                "$KIBANA_URL/api/agent_builder/agents" \
                -H "Authorization: ApiKey $API_KEY" \
                -H "kbn-xsrf: true" \
                -H "Content-Type: application/json" \
                -d "$AGENT")
            RETRY_CODE=$(echo "$RETRY" | tail -1)
            if [ "$RETRY_CODE" = "200" ] || [ "$RETRY_CODE" = "201" ]; then
                echo "OK (recreated)"
                CREATED=$((CREATED + 1))
            else
                echo "FAILED on retry (HTTP $RETRY_CODE)"
                echo "    $(echo "$RETRY" | sed '$d' | head -1)"
                FAILED=$((FAILED + 1))
            fi
        else
            echo "DELETE FAILED (HTTP $DEL_CODE)"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "FAILED (HTTP $HTTP_CODE)"
        echo "    $(echo "$BODY" | head -1)"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=== Results: $CREATED created, $FAILED failed ==="

# Verify
echo ""
echo "=== Verifying agents ==="
curl -s -H "Authorization: ApiKey $API_KEY" \
    -H "kbn-xsrf: true" \
    "$KIBANA_URL/api/agent_builder/agents" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('results', data if isinstance(data, list) else [])
ic = [a for a in results if a.get('id', '').startswith('incident-cortex')]
print(f'Found {len(ic)} incident-cortex agents:')
for a in ic:
    tools = []
    for tg in a.get('configuration', {}).get('tools', []):
        tools.extend(tg.get('tool_ids', []))
    print(f'  {a[\"id\"]:35} tools={len(tools)}')
"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi

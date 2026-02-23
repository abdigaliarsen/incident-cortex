#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
else
    echo "ERROR: .env file not found. Copy .env.example to .env and fill in your credentials."
    exit 1
fi

# Validate required variables
MISSING=0
for VAR in ELASTICSEARCH_URL KIBANA_URL API_KEY; do
    if [ -z "${!VAR}" ]; then
        echo "ERROR: $VAR is not set in .env"
        MISSING=1
    fi
done
[ "$MISSING" -eq 1 ] && exit 1

echo "=== Incident Cortex Setup Validation ==="
echo ""

# Test Elasticsearch connectivity
echo "[1/3] Testing Elasticsearch connectivity..."
ES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: ApiKey $API_KEY" \
    "$ELASTICSEARCH_URL")

if [ "$ES_RESPONSE" = "200" ]; then
    echo "  Elasticsearch: OK ($ELASTICSEARCH_URL)"
else
    echo "  Elasticsearch: FAILED (HTTP $ES_RESPONSE)"
    echo "  Check your ELASTICSEARCH_URL and API_KEY in .env"
    exit 1
fi

# Test Kibana connectivity
echo "[2/3] Testing Kibana connectivity..."
KIBANA_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: ApiKey $API_KEY" \
    -H "kbn-xsrf: true" \
    "$KIBANA_URL/api/status")

if [ "$KIBANA_RESPONSE" = "200" ]; then
    echo "  Kibana: OK ($KIBANA_URL)"
else
    echo "  Kibana: FAILED (HTTP $KIBANA_RESPONSE)"
    echo "  Check your KIBANA_URL and API_KEY in .env"
    exit 1
fi

# Test Agent Builder access
echo "[3/3] Testing Agent Builder access..."
AB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: ApiKey $API_KEY" \
    -H "kbn-xsrf: true" \
    "$KIBANA_URL/api/agent_builder/agents")

if [ "$AB_RESPONSE" = "200" ]; then
    echo "  Agent Builder: OK"
else
    echo "  Agent Builder: FAILED (HTTP $AB_RESPONSE)"
    echo "  Your API key may not have Agent Builder privileges."
    echo "  Ensure you're on Elasticsearch Serverless with Agent Builder enabled."
    exit 1
fi

echo ""
echo "=== All checks passed! ==="
echo "You're ready to start building Incident Cortex."

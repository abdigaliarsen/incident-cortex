"""Phase 4 test gate: all 4 agents exist, have correct tools, respond to prompts."""
import pytest
import requests
from tests.conftest import INDICES

AGENT_IDS = [
    "incident-cortex-triage",
    "incident-cortex-log-analyzer",
    "incident-cortex-metrics",
    "incident-cortex-security",
]

LOG_ANALYZER_TOOLS = ["ic-find-error-spike", "ic-correlate-trace", "ic-find-first-occurrence"]
METRICS_TOOLS = [
    "ic-detect-metric-anomaly",
    "ic-correlate-deploy-metric",
    "ic-get-deployments",
    "ic-service-health-overview",
]
SECURITY_TOOLS = ["ic-check-security-alerts", "ic-investigate-ip", "ic-search-similar-incidents"]


@pytest.fixture(scope="module")
def all_agents(kibana_url, kibana_headers):
    """Fetch all agents from Agent Builder once per module."""
    resp = requests.get(f"{kibana_url}/api/agent_builder/agents", headers=kibana_headers)
    assert resp.status_code == 200, f"Failed to list agents: {resp.status_code}"
    data = resp.json()
    return data.get("results", data if isinstance(data, list) else [])


class TestAgentsExist:
    @pytest.mark.parametrize("agent_id", AGENT_IDS)
    def test_agent_exists(self, all_agents, agent_id):
        agent_ids = [a["id"] for a in all_agents]
        assert agent_id in agent_ids, f"Agent {agent_id} not found"

    @pytest.mark.parametrize("agent_id", AGENT_IDS)
    def test_agent_has_instructions(self, all_agents, agent_id):
        agent = next((a for a in all_agents if a["id"] == agent_id), None)
        assert agent is not None
        instructions = agent.get("configuration", {}).get("instructions", "")
        assert len(instructions) > 50, f"Agent {agent_id} instructions too short"


class TestAgentToolAssignments:
    def _get_tool_ids(self, agent):
        tool_ids = []
        for tool_group in agent.get("configuration", {}).get("tools", []):
            tool_ids.extend(tool_group.get("tool_ids", []))
        return tool_ids

    def test_triage_has_all_investigation_tools(self, all_agents):
        agent = next(a for a in all_agents if a["id"] == "incident-cortex-triage")
        tool_ids = self._get_tool_ids(agent)
        for tool in ["ic-find-error-spike", "ic-detect-metric-anomaly", "ic-check-security-alerts"]:
            assert tool in tool_ids, f"Triage missing tool {tool}"

    def test_log_analyzer_has_log_tools(self, all_agents):
        agent = next(a for a in all_agents if a["id"] == "incident-cortex-log-analyzer")
        tool_ids = self._get_tool_ids(agent)
        for tool in LOG_ANALYZER_TOOLS:
            assert tool in tool_ids, f"Log Analyzer missing tool {tool}"

    def test_metrics_has_metric_tools(self, all_agents):
        agent = next(a for a in all_agents if a["id"] == "incident-cortex-metrics")
        tool_ids = self._get_tool_ids(agent)
        for tool in METRICS_TOOLS:
            assert tool in tool_ids, f"Metrics Analyzer missing tool {tool}"

    def test_security_has_security_tools(self, all_agents):
        agent = next(a for a in all_agents if a["id"] == "incident-cortex-security")
        tool_ids = self._get_tool_ids(agent)
        for tool in SECURITY_TOOLS:
            assert tool in tool_ids, f"Security Analyst missing tool {tool}"


def _extract_message(data: dict) -> str:
    """Extract message from converse API response (nested under response.message)."""
    if "response" in data and isinstance(data["response"], dict):
        return data["response"].get("message", "")
    return data.get("message", data.get("output", ""))


class TestAgentConverse:
    """Test that agents respond via the converse API. These are slow (LLM calls)."""

    @pytest.mark.slow
    def test_triage_responds_to_health_query(self, kibana_url, kibana_headers):
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/converse",
            headers=kibana_headers,
            json={
                "input": "What is the health status of all services right now? Check the period from 2026-02-22T14:00:00Z to 2026-02-22T15:00:00Z.",
                "agent_id": "incident-cortex-triage",
            },
            timeout=120,
        )
        assert resp.status_code == 200, f"Converse failed: {resp.status_code} {resp.text[:200]}"
        message = _extract_message(resp.json())
        assert len(message) > 50, f"Response too short: {message[:100]}"

    @pytest.mark.slow
    def test_log_analyzer_responds(self, kibana_url, kibana_headers):
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/converse",
            headers=kibana_headers,
            json={
                "input": "Find error spikes in payment-service between 2026-02-22T14:25:00Z and 2026-02-22T14:45:00Z",
                "agent_id": "incident-cortex-log-analyzer",
            },
            timeout=120,
        )
        assert resp.status_code == 200, f"Converse failed: {resp.status_code}"
        message = _extract_message(resp.json())
        assert len(message) > 50, f"Response too short: {message[:100]}"

    @pytest.mark.slow
    def test_metrics_responds(self, kibana_url, kibana_headers):
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/converse",
            headers=kibana_headers,
            json={
                "input": "Check for CPU anomalies on node-3 between 2026-02-22T14:00:00Z and 2026-02-22T15:00:00Z",
                "agent_id": "incident-cortex-metrics",
            },
            timeout=120,
        )
        assert resp.status_code == 200, f"Converse failed: {resp.status_code}"
        message = _extract_message(resp.json())
        assert len(message) > 50, f"Response too short: {message[:100]}"

    @pytest.mark.slow
    def test_security_responds(self, kibana_url, kibana_headers):
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/converse",
            headers=kibana_headers,
            json={
                "input": "Are there any suspicious IP addresses in recent security alerts? Check 2026-02-22T14:00:00Z to 2026-02-22T15:00:00Z",
                "agent_id": "incident-cortex-security",
            },
            timeout=120,
        )
        assert resp.status_code == 200, f"Converse failed: {resp.status_code}"
        message = _extract_message(resp.json())
        assert len(message) > 50, f"Response too short: {message[:100]}"

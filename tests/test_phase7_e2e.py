"""Phase 7 test gate: full demo scenario end-to-end."""
import pytest
import requests

DEMO_PROMPT = (
    "ALERT: payment-service returning 500 errors since 2026-02-22T14:30:00Z. "
    "Multiple alerts firing: error_rate_high, latency_spike, suspicious_login_attempts. "
    "Investigation window: 2026-02-22T14:00:00Z to 2026-02-22T15:00:00Z. "
    "Investigate and recommend remediation."
)


def _extract_message(data: dict) -> str:
    """Extract message from converse API response."""
    if "response" in data and isinstance(data["response"], dict):
        return data["response"].get("message", "")
    return data.get("message", data.get("output", ""))


@pytest.fixture(scope="module")
def investigation_response(kibana_url, kibana_headers):
    """Run the demo scenario once and share the response across tests."""
    resp = requests.post(
        f"{kibana_url}/api/agent_builder/converse",
        headers=kibana_headers,
        json={
            "input": DEMO_PROMPT,
            "agent_id": "incident-cortex-triage",
        },
        timeout=300,
    )
    assert resp.status_code == 200, f"Demo scenario failed: {resp.status_code}"
    return resp.json()


class TestDemoScenarioFindings:
    @pytest.mark.slow
    def test_response_not_empty(self, investigation_response):
        message = _extract_message(investigation_response)
        assert len(message) > 100, "Response too short for a full investigation"

    @pytest.mark.slow
    def test_mentions_errors(self, investigation_response):
        message = _extract_message(investigation_response).lower()
        assert any(
            term in message for term in ["error", "exception", "500", "spike"]
        ), "Investigation didn't mention errors"

    @pytest.mark.slow
    def test_mentions_metrics(self, investigation_response):
        message = _extract_message(investigation_response).lower()
        assert any(
            term in message
            for term in ["cpu", "latency", "memory", "node-3", "metric"]
        ), "Investigation didn't mention metrics"

    @pytest.mark.slow
    def test_mentions_deployment(self, investigation_response):
        message = _extract_message(investigation_response).lower()
        assert any(
            term in message
            for term in ["deploy", "v2.4.1", "rollback", "version"]
        ), "Investigation didn't mention deployment"

    @pytest.mark.slow
    def test_mentions_security(self, investigation_response):
        message = _extract_message(investigation_response).lower()
        assert any(
            term in message
            for term in ["brute", "203.0.113", "security", "suspicious", "attack"]
        ), "Investigation didn't mention security threats"

    @pytest.mark.slow
    def test_used_tools(self, investigation_response):
        """Verify the agent actually used ES|QL tools during investigation."""
        steps = investigation_response.get("steps", [])
        tool_calls = []
        for step in steps:
            for tc in step.get("tool_calls", []):
                tool_calls.append(tc.get("tool_id", ""))
        ic_tools = [t for t in tool_calls if t.startswith("ic-")]
        assert len(ic_tools) >= 2, f"Expected at least 2 ic-* tool calls, got {len(ic_tools)}: {ic_tools}"

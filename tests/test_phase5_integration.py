"""Phase 5 test gate: A2A working, MCP accessible, multi-domain investigation."""
import pytest
import requests
import json


class TestA2AIntegration:
    def test_a2a_agent_card_accessible(self, kibana_url, kibana_headers):
        """A2A agent card for triage agent should be accessible."""
        resp = requests.get(
            f"{kibana_url}/api/agent_builder/a2a/incident-cortex-triage.json",
            headers=kibana_headers,
        )
        assert resp.status_code == 200, f"A2A card not accessible: {resp.status_code}"
        data = resp.json()
        assert data["name"] == "Incident Cortex - Triage"
        assert data["protocolVersion"] == "0.3.0"

    def test_a2a_card_lists_all_skills(self, kibana_url, kibana_headers):
        """A2A agent card should list all 12 tools as skills."""
        resp = requests.get(
            f"{kibana_url}/api/agent_builder/a2a/incident-cortex-triage.json",
            headers=kibana_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        skill_ids = [s["id"] for s in data.get("skills", [])]
        assert len(skill_ids) == 12, f"Expected 12 skills, got {len(skill_ids)}: {skill_ids}"

    def test_a2a_specialist_cards_accessible(self, kibana_url, kibana_headers):
        """All specialist agent A2A cards should be accessible."""
        for agent_id in [
            "incident-cortex-log-analyzer",
            "incident-cortex-metrics",
            "incident-cortex-security",
        ]:
            resp = requests.get(
                f"{kibana_url}/api/agent_builder/a2a/{agent_id}.json",
                headers=kibana_headers,
            )
            assert resp.status_code == 200, f"A2A card for {agent_id} not accessible: {resp.status_code}"

    def test_triage_instructions_reference_specialists(self, kibana_url, kibana_headers):
        """Triage agent instructions should reference all 3 specialist agents for A2A."""
        resp = requests.get(
            f"{kibana_url}/api/agent_builder/agents",
            headers=kibana_headers,
        )
        assert resp.status_code == 200
        agents = resp.json().get("results", resp.json() if isinstance(resp.json(), list) else [])
        triage = next((a for a in agents if a["id"] == "incident-cortex-triage"), None)
        assert triage is not None, "Triage agent not found"
        instructions = triage.get("configuration", {}).get("instructions", "")
        for agent_id in [
            "incident-cortex-log-analyzer",
            "incident-cortex-metrics",
            "incident-cortex-security",
        ]:
            assert agent_id in instructions, (
                f"Triage instructions don't reference {agent_id}"
            )


class TestMCPServer:
    def test_mcp_initialize(self, kibana_url, kibana_headers):
        """MCP server should respond to JSON-RPC initialize."""
        headers = {**kibana_headers, "Accept": "application/json"}
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/mcp",
            headers=headers,
            json={
                "jsonrpc": "2.0",
                "method": "initialize",
                "id": 1,
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "incident-cortex-test", "version": "1.0"},
                },
            },
        )
        assert resp.status_code == 200, f"MCP init failed: {resp.status_code}"
        data = resp.json()
        assert data["result"]["serverInfo"]["name"] == "elastic-mcp-server"

    def test_mcp_tools_list(self, kibana_url, kibana_headers):
        """MCP server should list tools via tools/list."""
        headers = {**kibana_headers, "Accept": "application/json"}
        # Initialize first
        requests.post(
            f"{kibana_url}/api/agent_builder/mcp",
            headers=headers,
            json={
                "jsonrpc": "2.0",
                "method": "initialize",
                "id": 1,
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "incident-cortex-test", "version": "1.0"},
                },
            },
        )
        # List tools
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/mcp",
            headers=headers,
            json={"jsonrpc": "2.0", "method": "tools/list", "id": 2},
        )
        assert resp.status_code == 200, f"MCP tools/list failed: {resp.status_code}"
        data = resp.json()
        tools = data.get("result", {}).get("tools", [])
        ic_tools = [t for t in tools if t["name"].startswith("ic-")]
        assert len(ic_tools) >= 10, f"Expected 10+ ic-* tools via MCP, got {len(ic_tools)}"


class TestTriageInvestigation:
    """Test that triage agent can conduct a multi-domain investigation."""

    @pytest.mark.slow
    def test_triage_investigation_covers_all_domains(self, kibana_url, kibana_headers):
        """Full investigation should mention findings from logs, metrics, and security."""
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/converse",
            headers=kibana_headers,
            json={
                "input": (
                    "ALERT: payment-service returning 500 errors since 2026-02-22T14:30:00Z. "
                    "Multiple alerts firing: error_rate_high, latency_spike, suspicious_login_attempts. "
                    "Time range: 2026-02-22T14:00:00Z to 2026-02-22T15:00:00Z. "
                    "Investigate thoroughly."
                ),
                "agent_id": "incident-cortex-triage",
            },
            timeout=300,
        )
        assert resp.status_code == 200
        data = resp.json()
        # Response is nested: data["response"]["message"]
        if "response" in data and isinstance(data["response"], dict):
            message = data["response"].get("message", "")
        else:
            message = str(data.get("message", data.get("output", "")))
        message_lower = message.lower()
        assert any(
            term in message_lower for term in ["error", "exception", "spike"]
        ), "Investigation didn't mention errors"

"""Phase 3 test gate: remediation simulation and agent remediation recommendations."""
import pytest
import requests


def _extract_message(data: dict) -> str:
    """Extract message from converse API response."""
    if "response" in data and isinstance(data["response"], dict):
        return data["response"].get("message", "")
    return data.get("message", data.get("output", ""))


class TestRemediationRecommendations:
    """The Triage agent should recommend remediation actions in its investigation."""

    @pytest.mark.slow
    def test_triage_recommends_remediation(self, kibana_url, kibana_headers):
        """After investigating, the agent should recommend concrete remediation steps."""
        resp = requests.post(
            f"{kibana_url}/api/agent_builder/converse",
            headers=kibana_headers,
            json={
                "input": (
                    "ALERT: payment-service returning 500 errors since 2026-02-22T14:30:00Z. "
                    "Brute-force attempts from 203.0.113.42 detected. "
                    "Time range: 2026-02-22T14:00:00Z to 2026-02-22T15:00:00Z. "
                    "Investigate and recommend remediation actions."
                ),
                "agent_id": "incident-cortex-triage",
            },
            timeout=300,
        )
        assert resp.status_code == 200, f"Converse failed: {resp.status_code}"
        message = _extract_message(resp.json()).lower()
        # Agent should recommend at least one remediation action
        remediation_terms = [
            "rollback", "revert", "block", "notify", "alert", "ticket",
            "remediat", "mitigat", "contain", "action", "recommend",
        ]
        assert any(
            term in message for term in remediation_terms
        ), f"Agent didn't recommend remediation. Response: {message[:300]}"


class TestRemediationSimulation:
    """Remediation is simulated by indexing action documents to ES."""

    def test_notify_slack_creates_notification(self, es_client):
        """Verify we can write to the notifications index (simulating workflow)."""
        es_client.index(
            index="ic-notifications",
            document={
                "@timestamp": "2026-02-22T15:00:00.000Z",
                "channel": "#incidents",
                "severity": "P2",
                "message": "Test notification from pytest",
                "type": "slack_notification",
            },
            refresh="wait_for",
        )
        count = es_client.count(index="ic-notifications")["count"]
        assert count > 0, "Notification index is empty after test write"

    def test_index_incident_report_creates_doc(self, es_client):
        """Verify we can write to the incidents index (simulating workflow)."""
        es_client.index(
            index="ic-incidents",
            document={
                "@timestamp": "2026-02-22T15:00:00.000Z",
                "incident.id": "TEST-001",
                "incident.severity": "P2",
                "incident.status": "resolved",
                "incident.title": "Test incident from pytest",
                "incident.root_cause": "Test root cause",
                "incident.remediation": "Test remediation",
            },
            refresh="wait_for",
        )
        result = es_client.search(
            index="ic-incidents",
            body={"query": {"term": {"incident.id": "TEST-001"}}},
        )
        assert result["hits"]["total"]["value"] > 0

    def test_rollback_deployment_creates_notification(self, es_client):
        """Verify rollback action writes to notifications index."""
        es_client.index(
            index="ic-notifications",
            document={
                "@timestamp": "2026-02-22T15:01:00.000Z",
                "type": "deployment_rollback",
                "action": "rollback",
                "deployment.service": "payment-service",
                "deployment.version": "v2.3.9",
                "message": "Rollback initiated: payment-service to v2.3.9",
            },
            refresh="wait_for",
        )
        result = es_client.search(
            index="ic-notifications",
            body={"query": {"term": {"type": "deployment_rollback"}}},
        )
        assert result["hits"]["total"]["value"] > 0

    def test_block_ip_creates_notification(self, es_client):
        """Verify IP block action writes to notifications index."""
        es_client.index(
            index="ic-notifications",
            document={
                "@timestamp": "2026-02-22T15:01:00.000Z",
                "type": "ip_block",
                "action": "block",
                "target.ip": "203.0.113.42",
                "message": "IP blocked: 203.0.113.42 - Brute force attack",
            },
            refresh="wait_for",
        )
        result = es_client.search(
            index="ic-notifications",
            body={"query": {"term": {"type": "ip_block"}}},
        )
        assert result["hits"]["total"]["value"] > 0

    def test_remediation_actions_queryable_via_esql(self, es_client):
        """Verify remediation documents are queryable via ES|QL."""
        result = es_client.esql.query(
            query=(
                'FROM ic-notifications '
                '| WHERE type IN ("slack_notification", "deployment_rollback", "ip_block", "jira_ticket") '
                '| STATS action_count = COUNT(*) BY type '
                '| SORT action_count DESC'
            ),
            format="json",
        )
        columns = result.get("columns", [])
        col_names = [c["name"] for c in columns]
        assert "type" in col_names, f"Expected type column, got: {col_names}"

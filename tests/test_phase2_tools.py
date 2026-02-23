"""Phase 2: Investigation Tools — Tests for all 10 ES|QL custom tools."""

import pytest
import requests


# All 10 tool IDs that must exist in Agent Builder
TOOL_IDS = [
    "ic-find-error-spike",
    "ic-correlate-trace",
    "ic-find-first-occurrence",
    "ic-detect-metric-anomaly",
    "ic-correlate-deploy-metric",
    "ic-check-security-alerts",
    "ic-investigate-ip",
    "ic-get-deployments",
    "ic-search-similar-incidents",
    "ic-service-health-overview",
]


@pytest.fixture(scope="module")
def all_tools(kibana_url, kibana_headers):
    """Fetch all tools from Agent Builder once per module."""
    resp = requests.get(
        f"{kibana_url}/api/agent_builder/tools",
        headers=kibana_headers,
    )
    assert resp.status_code == 200, f"Failed to list tools: {resp.text}"
    data = resp.json()
    # API returns {"results": [...]}
    return {t["id"]: t for t in data.get("results", data)}


# ── Tool existence & metadata tests ──────────────────────────────────────────


class TestToolsExist:
    """Verify all 10 ic-* tools are registered in Agent Builder."""

    @pytest.mark.parametrize("tool_id", TOOL_IDS)
    def test_tool_exists(self, all_tools, tool_id):
        assert tool_id in all_tools, (
            f"Tool '{tool_id}' not found in Agent Builder. "
            f"Found ic-* tools: {[k for k in all_tools if k.startswith('ic-')]}"
        )

    @pytest.mark.parametrize("tool_id", TOOL_IDS)
    def test_tool_type_is_esql(self, all_tools, tool_id):
        if tool_id not in all_tools:
            pytest.skip(f"Tool '{tool_id}' not yet created")
        assert all_tools[tool_id]["type"] == "esql", (
            f"Tool '{tool_id}' has type '{all_tools[tool_id]['type']}', expected 'esql'"
        )

    @pytest.mark.parametrize("tool_id", TOOL_IDS)
    def test_tool_description_length(self, all_tools, tool_id):
        if tool_id not in all_tools:
            pytest.skip(f"Tool '{tool_id}' not yet created")
        desc = all_tools[tool_id].get("description", "")
        assert len(desc) > 20, (
            f"Tool '{tool_id}' description too short ({len(desc)} chars): '{desc}'"
        )

    def test_all_ten_tools_present(self, all_tools):
        ic_tools = [k for k in all_tools if k.startswith("ic-")]
        assert len(ic_tools) >= 10, (
            f"Expected at least 10 ic-* tools, found {len(ic_tools)}: {ic_tools}"
        )


# ── ES|QL data query tests ──────────────────────────────────────────────────


class TestEsqlQueries:
    """Run ES|QL queries against ic-* indices and verify expected results."""

    def _run_esql(self, es_client, query: str) -> dict:
        """Execute an ES|QL query and return the result."""
        result = es_client.esql.query(query=query, format="json")
        return result

    def _rows(self, result: dict) -> list[dict]:
        """Convert ES|QL result to list of row dicts."""
        columns = result.get("columns", [])
        values = result.get("values", [])
        col_names = [c["name"] for c in columns]
        return [dict(zip(col_names, row)) for row in values]

    def test_find_error_spike(self, es_client):
        """ic-find-error-spike: error counts by minute for payment-service."""
        query = (
            'FROM ic-logs '
            '| WHERE @timestamp >= "2026-02-22T14:25:00.000Z" '
            'AND @timestamp <= "2026-02-22T14:45:00.000Z" '
            'AND service.name == "payment-service" '
            'AND log.level == "error" '
            '| STATS error_count = COUNT(*) BY ts_bucket = BUCKET(@timestamp, 1 minute) '
            '| SORT ts_bucket '
            '| LIMIT 20'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected error spike data for payment-service"
        # Verify we got error_count column
        assert "error_count" in rows[0], f"Missing error_count column: {rows[0].keys()}"
        total_errors = sum(r["error_count"] for r in rows)
        assert total_errors > 0, "Expected nonzero total error count"

    def test_detect_metric_anomaly(self, es_client):
        """ic-detect-metric-anomaly: CPU anomalies on node-3."""
        query = (
            'FROM ic-metrics '
            '| WHERE host.name == "node-3" '
            'AND @timestamp >= "2026-02-22T14:25:00.000Z" '
            'AND @timestamp <= "2026-02-22T14:45:00.000Z" '
            '| STATS max_cpu = MAX(system.cpu.total.pct) '
            'BY ts_bucket = BUCKET(@timestamp, 5 minutes) '
            '| SORT ts_bucket '
            '| LIMIT 20'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected metric data for node-3"
        high_cpu = [r for r in rows if r["max_cpu"] is not None and r["max_cpu"] > 0.7]
        assert len(high_cpu) >= 1, (
            f"Expected at least one bucket with CPU > 0.7, "
            f"got max values: {[r['max_cpu'] for r in rows]}"
        )

    def test_check_security_alerts(self, es_client):
        """ic-check-security-alerts: alert counts by rule name."""
        query = (
            'FROM ic-security-alerts '
            '| WHERE @timestamp >= "2026-02-22T14:00:00.000Z" '
            'AND @timestamp <= "2026-02-22T15:00:00.000Z" '
            '| STATS alert_count = COUNT(*) BY alert.rule_name '
            '| SORT alert_count DESC '
            '| LIMIT 10'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected security alert data"
        assert "alert_count" in rows[0], f"Missing alert_count column: {rows[0].keys()}"
        assert "alert.rule_name" in rows[0], f"Missing alert.rule_name column: {rows[0].keys()}"

    def test_get_deployments(self, es_client):
        """ic-get-deployments: payment-service deployments."""
        query = (
            'FROM ic-deployments '
            '| WHERE deployment.service == "payment-service" '
            'AND @timestamp >= "2026-02-22T00:00:00.000Z" '
            '| SORT @timestamp DESC '
            '| LIMIT 10'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected deployment data for payment-service"
        assert "deployment.service" in rows[0], f"Missing deployment.service: {rows[0].keys()}"

    def test_investigate_ip(self, es_client):
        """ic-investigate-ip: activity for suspicious IP 203.0.113.42."""
        query = (
            'FROM ic-security-alerts '
            '| WHERE source.ip == "203.0.113.42" '
            'AND @timestamp >= "2026-02-22T14:00:00.000Z" '
            '| STATS attempt_count = COUNT(*) BY ts_bucket = BUCKET(@timestamp, 5 minutes) '
            '| SORT ts_bucket '
            '| LIMIT 20'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected security alert data for IP 203.0.113.42"
        assert "attempt_count" in rows[0], f"Missing attempt_count column: {rows[0].keys()}"

    def test_service_health_overview(self, es_client):
        """ic-service-health-overview: avg CPU and latency by service."""
        query = (
            'FROM ic-metrics '
            '| WHERE @timestamp >= "2026-02-22T14:00:00.000Z" '
            'AND @timestamp <= "2026-02-22T15:00:00.000Z" '
            '| STATS avg_cpu = AVG(system.cpu.total.pct), '
            'avg_latency = AVG(http.response.latency_ms) '
            'BY service.name '
            '| SORT avg_latency DESC'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) >= 5, (
            f"Expected at least 5 services, got {len(rows)}: "
            f"{[r.get('service.name') for r in rows]}"
        )
        assert "avg_cpu" in rows[0], f"Missing avg_cpu column: {rows[0].keys()}"
        assert "avg_latency" in rows[0], f"Missing avg_latency column: {rows[0].keys()}"

    def test_correlate_trace(self, es_client):
        """ic-correlate-trace: verify trace data exists in ic-logs."""
        # First, find a trace ID that exists
        find_query = (
            'FROM ic-logs '
            '| WHERE trace.id IS NOT NULL '
            '| KEEP trace.id '
            '| LIMIT 1'
        )
        result = self._run_esql(es_client, find_query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected at least one log entry with a trace.id"
        trace_id = rows[0]["trace.id"]

        # Now query for that trace
        query = (
            f'FROM ic-logs '
            f'| WHERE trace.id == "{trace_id}" '
            f'| SORT @timestamp '
            f'| LIMIT 100'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) >= 1, f"Expected logs for trace.id={trace_id}"

    def test_find_first_occurrence(self, es_client):
        """ic-find-first-occurrence: earliest errors for payment-service."""
        query = (
            'FROM ic-logs '
            '| WHERE service.name == "payment-service" '
            'AND log.level == "error" '
            'AND @timestamp >= "2026-02-22T14:00:00.000Z" '
            '| SORT @timestamp '
            '| LIMIT 5'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected error logs for payment-service"
        # Verify they are sorted chronologically (earliest first)
        timestamps = [r["@timestamp"] for r in rows]
        assert timestamps == sorted(timestamps), "Results should be sorted by timestamp ASC"

    def test_correlate_deploy_metric(self, es_client):
        """ic-correlate-deploy-metric: metrics by host and 5-min bucket."""
        query = (
            'FROM ic-metrics '
            '| WHERE @timestamp >= "2026-02-22T14:00:00.000Z" '
            'AND @timestamp <= "2026-02-22T15:00:00.000Z" '
            'AND service.name == "payment-service" '
            '| STATS avg_cpu = AVG(system.cpu.total.pct), '
            'avg_latency = AVG(http.response.latency_ms) '
            'BY host.name, ts_bucket = BUCKET(@timestamp, 5 minutes) '
            '| SORT ts_bucket '
            '| LIMIT 20'
        )
        result = self._run_esql(es_client, query)
        rows = self._rows(result)
        assert len(rows) > 0, "Expected metric data for payment-service by host"
        assert "host.name" in rows[0], f"Missing host.name column: {rows[0].keys()}"
        assert "avg_cpu" in rows[0], f"Missing avg_cpu column: {rows[0].keys()}"

    def test_search_similar_incidents(self, es_client):
        """ic-search-similar-incidents: query runs against ic-incidents index."""
        query = (
            'FROM ic-incidents '
            '| WHERE incident.status == "resolved" '
            '| SORT @timestamp DESC '
            '| LIMIT 10'
        )
        result = self._run_esql(es_client, query)
        # ic-incidents may be empty (populated by workflow during live demo).
        # Verify the query executes without error -- schema is valid.
        columns = result.get("columns", [])
        col_names = [c["name"] for c in columns]
        assert "incident.status" in col_names, (
            f"Expected incident.status column in result, got: {col_names}"
        )

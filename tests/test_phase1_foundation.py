"""Phase 1 test gate: indices exist, mappings correct, data counts match, incident signals present."""
import pytest
from tests.conftest import INDICES, SERVICES, HOSTS


class TestIndicesExist:
    """All 7 indices must exist with correct mappings."""

    @pytest.mark.parametrize("index", INDICES)
    def test_index_exists(self, es_client, index):
        assert es_client.indices.exists(index=index), f"Index {index} does not exist"

    def test_logs_mapping_has_required_fields(self, es_client):
        mapping = es_client.indices.get_mapping(index="logs-incident-cortex")
        props = mapping["logs-incident-cortex"]["mappings"]["properties"]
        assert "@timestamp" in props
        assert "service.name" in props or "service" in props
        assert "log.level" in props or "log" in props
        assert "message" in props
        assert "trace.id" in props or "trace" in props
        assert "host.name" in props or "host" in props

    def test_metrics_mapping_has_required_fields(self, es_client):
        mapping = es_client.indices.get_mapping(index="metrics-incident-cortex")
        props = mapping["metrics-incident-cortex"]["mappings"]["properties"]
        assert "@timestamp" in props
        assert "host.name" in props or "host" in props
        assert "system.cpu.total.pct" in props or "system" in props

    def test_security_mapping_has_required_fields(self, es_client):
        mapping = es_client.indices.get_mapping(index="security-alerts-incident-cortex")
        props = mapping["security-alerts-incident-cortex"]["mappings"]["properties"]
        assert "@timestamp" in props
        assert "source.ip" in props or "source" in props
        assert "alert.severity" in props or "alert" in props


class TestDataCounts:
    """Synthetic data volumes within expected ranges."""

    def test_logs_count(self, es_client):
        count = es_client.count(index="logs-incident-cortex")["count"]
        assert 8_000 <= count <= 15_000, f"Logs count {count} outside range 8K-15K"

    def test_metrics_count(self, es_client):
        count = es_client.count(index="metrics-incident-cortex")["count"]
        assert 12_000 <= count <= 18_000, f"Metrics count {count} outside range 12K-18K"

    def test_security_alerts_count(self, es_client):
        count = es_client.count(index="security-alerts-incident-cortex")["count"]
        assert 150 <= count <= 500, f"Security count {count} outside range 150-500"

    def test_deployments_count(self, es_client):
        count = es_client.count(index="deployments-incident-cortex")["count"]
        assert 15 <= count <= 30, f"Deployments count {count} outside range 15-30"

    def test_threat_intel_count(self, es_client):
        count = es_client.count(index="threat-intel-incident-cortex")["count"]
        assert 30 <= count <= 80, f"Threat intel count {count} outside range 30-80"


class TestIncidentScenarioSignals:
    """The synthetic incident scenario signals must be discoverable."""

    def test_payment_service_errors_in_incident_window(self, es_client):
        result = es_client.search(
            index="logs-incident-cortex",
            body={
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"service.name": "payment-service"}},
                            {"term": {"log.level": "error"}},
                            {
                                "range": {
                                    "@timestamp": {
                                        "gte": "2026-02-22T14:25:00.000Z",
                                        "lte": "2026-02-22T14:45:00.000Z",
                                    }
                                }
                            },
                        ]
                    }
                },
            },
            size=0,
        )
        assert result["hits"]["total"]["value"] > 0, "No payment-service errors found in incident window"

    def test_cpu_spike_on_node3(self, es_client):
        result = es_client.search(
            index="metrics-incident-cortex",
            body={
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"host.name": "node-3"}},
                            {"range": {"system.cpu.total.pct": {"gte": 0.8}}},
                            {
                                "range": {
                                    "@timestamp": {
                                        "gte": "2026-02-22T14:25:00.000Z",
                                        "lte": "2026-02-22T14:45:00.000Z",
                                    }
                                }
                            },
                        ]
                    }
                },
            },
            size=0,
        )
        assert result["hits"]["total"]["value"] > 0, "No CPU spike found on node-3"

    def test_brute_force_from_known_ip(self, es_client):
        result = es_client.search(
            index="security-alerts-incident-cortex",
            body={
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"source.ip": "203.0.113.42"}},
                        ]
                    }
                },
            },
            size=0,
        )
        assert result["hits"]["total"]["value"] > 0, "No brute-force events from 203.0.113.42"

    def test_deployment_v241_exists(self, es_client):
        result = es_client.search(
            index="deployments-incident-cortex",
            body={
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"deployment.version": "v2.4.1"}},
                            {"term": {"deployment.service": "payment-service"}},
                        ]
                    }
                },
            },
            size=0,
        )
        assert result["hits"]["total"]["value"] > 0, "Deployment v2.4.1 not found"

    def test_all_five_services_present(self, es_client):
        result = es_client.search(
            index="logs-incident-cortex",
            body={"aggs": {"services": {"terms": {"field": "service.name", "size": 10}}}},
            size=0,
        )
        found_services = {b["key"] for b in result["aggregations"]["services"]["buckets"]}
        for svc in SERVICES:
            assert svc in found_services, f"Service {svc} not found in logs"

    def test_all_ten_hosts_present(self, es_client):
        result = es_client.search(
            index="metrics-incident-cortex",
            body={"aggs": {"hosts": {"terms": {"field": "host.name", "size": 15}}}},
            size=0,
        )
        found_hosts = {b["key"] for b in result["aggregations"]["hosts"]["buckets"]}
        for host in HOSTS:
            assert host in found_hosts, f"Host {host} not found in metrics"

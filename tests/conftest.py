import os
import pytest
from elasticsearch import Elasticsearch
from dotenv import load_dotenv

load_dotenv()


@pytest.fixture(scope="session")
def es_client():
    """Elasticsearch client for the entire test session."""
    client = Elasticsearch(
        os.environ["ELASTICSEARCH_URL"],
        api_key=os.environ["API_KEY"],
    )
    yield client
    client.close()


@pytest.fixture(scope="session")
def kibana_url():
    return os.environ["KIBANA_URL"]


@pytest.fixture(scope="session")
def api_key():
    return os.environ["API_KEY"]


@pytest.fixture(scope="session")
def kibana_headers(api_key):
    """Standard headers for Kibana API requests."""
    return {
        "Authorization": f"ApiKey {api_key}",
        "kbn-xsrf": "true",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def incident_window():
    """The known incident time window from synthetic data."""
    return {
        "start": "2026-02-22T14:00:00.000Z",
        "end": "2026-02-22T15:00:00.000Z",
    }


INDICES = [
    "ic-logs",
    "ic-metrics",
    "ic-security-alerts",
    "ic-deployments",
    "ic-threat-intel",
    "ic-incidents",
    "ic-notifications",
]

SERVICES = [
    "payment-service",
    "user-service",
    "api-gateway",
    "notification-service",
    "inventory-service",
]

HOSTS = [f"node-{i}" for i in range(1, 11)]

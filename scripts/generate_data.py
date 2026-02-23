"""Generate synthetic incident data for Incident Cortex.

Creates a coherent incident scenario across logs, metrics, security alerts,
deployments, and threat intelligence indices in Elasticsearch.
"""

import json
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from faker import Faker

load_dotenv()

fake = Faker()
Faker.seed(42)
random.seed(42)

# --- Configuration ---

SERVICES = [
    "payment-service",
    "user-service",
    "api-gateway",
    "notification-service",
    "inventory-service",
]

# Map services to primary hosts
SERVICE_HOSTS: dict[str, list[str]] = {
    "payment-service": ["node-3", "node-7"],
    "user-service": ["node-1", "node-2"],
    "api-gateway": ["node-4", "node-5"],
    "notification-service": ["node-6", "node-8"],
    "inventory-service": ["node-9", "node-10"],
}

HOSTS = [f"node-{i}" for i in range(1, 11)]

LOG_LEVELS_NORMAL = {"info": 0.70, "debug": 0.20, "warn": 0.08, "error": 0.02}
LOG_LEVELS_INCIDENT = {"info": 0.05, "debug": 0.02, "warn": 0.13, "error": 0.80}

# Incident window: 2026-02-22 14:25 to 14:45 UTC
BASELINE_START = datetime(2026, 2, 21, 14, 0, 0, tzinfo=timezone.utc)
BASELINE_END = datetime(2026, 2, 22, 14, 25, 0, tzinfo=timezone.utc)
INCIDENT_START = datetime(2026, 2, 22, 14, 25, 0, tzinfo=timezone.utc)
INCIDENT_END = datetime(2026, 2, 22, 14, 45, 0, tzinfo=timezone.utc)
POST_INCIDENT = datetime(2026, 2, 22, 15, 0, 0, tzinfo=timezone.utc)

BRUTE_FORCE_IP = "203.0.113.42"

NORMAL_LOG_MESSAGES = {
    "payment-service": [
        "Processing payment request for order {order_id}",
        "Payment completed successfully for user {user}",
        "Payment gateway response received in {ms}ms",
        "Validating payment method for user {user}",
        "Refund processed for order {order_id}",
    ],
    "user-service": [
        "User {user} logged in successfully",
        "Session token refreshed for user {user}",
        "Profile update for user {user}",
        "Password validation passed for user {user}",
        "User registration completed for {user}",
    ],
    "api-gateway": [
        "Routing request to {service}",
        "Rate limit check passed for client {client_id}",
        "Request authenticated via API key",
        "Response cached for endpoint {endpoint}",
        "Health check passed for {service}",
    ],
    "notification-service": [
        "Email sent to {user} for order {order_id}",
        "Push notification queued for {user}",
        "SMS delivery confirmed for user {user}",
        "Notification template rendered for {template}",
        "Batch notification job completed",
    ],
    "inventory-service": [
        "Stock check for product {product_id}: {qty} available",
        "Inventory reserved for order {order_id}",
        "Warehouse sync completed in {ms}ms",
        "Product catalog refreshed: {count} items",
        "Low stock alert for product {product_id}",
    ],
}

ERROR_MESSAGES = {
    "payment-service": [
        "java.lang.NullPointerException: Cannot invoke method getPaymentToken() on null reference\n"
        "    at com.cortex.payment.PaymentProcessor.processPayment(PaymentProcessor.java:142)\n"
        "    at com.cortex.payment.PaymentController.handleRequest(PaymentController.java:87)\n"
        "    at org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)",
        "java.lang.NullPointerException: Payment gateway connection pool exhausted\n"
        "    at com.cortex.payment.GatewayClient.getConnection(GatewayClient.java:63)\n"
        "    at com.cortex.payment.PaymentProcessor.submitPayment(PaymentProcessor.java:201)",
        "ConnectionTimeoutException: Failed to connect to payment gateway after 30000ms",
    ],
    "api-gateway": [
        "UpstreamTimeoutException: payment-service did not respond within 3000ms",
        "CircuitBreaker OPEN for payment-service - too many failures",
        "503 Service Unavailable: payment-service circuit breaker tripped",
    ],
    "notification-service": [
        "TimeoutException: Failed to retrieve payment status from payment-service",
        "RetryExhausted: notification delivery failed after 3 attempts",
    ],
}

SECURITY_RULES_NORMAL = [
    ("successful_login", "authentication", "low"),
    ("port_scan_detected", "network", "medium"),
    ("policy_violation", "compliance", "low"),
    ("file_integrity_change", "host", "medium"),
    ("anomalous_process", "host", "low"),
]

THREAT_ACTORS = [
    "APT-Phantom",
    "DarkHydra",
    "SilverFox",
    "CryptoLock Group",
    "NightOwl Collective",
]


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def random_ts(start: datetime, end: datetime) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def pick_level(distribution: dict[str, float]) -> str:
    r = random.random()
    cumulative = 0.0
    for level, prob in distribution.items():
        cumulative += prob
        if r <= cumulative:
            return level
    return "info"


def gen_log_message(service: str, level: str) -> tuple[str, str | None, str | None]:
    """Return (message, error_type, stack_trace)."""
    if level == "error" and service in ERROR_MESSAGES:
        msg = random.choice(ERROR_MESSAGES[service])
        lines = msg.split("\n")
        error_type = lines[0].split(":")[0] if ":" in lines[0] else "Error"
        return lines[0], error_type, msg
    if level == "warn":
        return f"Slow response detected: {random.randint(500, 2000)}ms for {service}", None, None
    templates = NORMAL_LOG_MESSAGES.get(service, ["Processing request"])
    template = random.choice(templates)
    msg = template.format(
        order_id=f"ORD-{random.randint(10000, 99999)}",
        user=fake.user_name(),
        ms=random.randint(10, 300),
        service=random.choice(SERVICES),
        client_id=f"client-{random.randint(1, 50)}",
        endpoint=f"/api/v1/{random.choice(['users', 'payments', 'orders', 'products'])}",
        template=random.choice(["order_confirm", "welcome", "password_reset"]),
        product_id=f"PROD-{random.randint(1000, 9999)}",
        qty=random.randint(0, 500),
        count=random.randint(1000, 50000),
    )
    return msg, None, None


def generate_logs() -> list[dict]:
    """Generate ~10K log entries: 24h baseline + incident window."""
    docs = []
    trace_pool: list[str] = [str(uuid.uuid4()) for _ in range(200)]

    # Baseline: ~400/hour for 24 hours = ~9600
    current = BASELINE_START
    while current < BASELINE_END:
        for _ in range(random.randint(380, 420)):
            service = random.choice(SERVICES)
            host = random.choice(SERVICE_HOSTS[service])
            level = pick_level(LOG_LEVELS_NORMAL)
            ts = random_ts(current, current + timedelta(hours=1))
            message, error_type, stack_trace = gen_log_message(service, level)

            doc = {
                "@timestamp": iso(ts),
                "service.name": service,
                "log.level": level,
                "message": message,
                "trace.id": random.choice(trace_pool),
                "host.name": host,
            }
            if error_type:
                doc["error.type"] = error_type
            if stack_trace:
                doc["error.stack_trace"] = stack_trace
            docs.append(doc)
        current += timedelta(hours=1)

    # Incident window: payment-service errors spike on node-3 and node-7
    # 14:25-14:30: brute-force starts, normal elsewhere
    # 14:28: deployment happens
    # 14:30-14:45: error storm on payment-service
    incident_current = INCIDENT_START
    while incident_current < INCIDENT_END:
        minute_end = incident_current + timedelta(minutes=1)
        for service in SERVICES:
            if service == "payment-service" and incident_current >= datetime(2026, 2, 22, 14, 30, tzinfo=timezone.utc):
                # Heavy error storm: 80-100 errors/minute
                for _ in range(random.randint(80, 100)):
                    host = random.choice(["node-3", "node-7"])
                    level = pick_level(LOG_LEVELS_INCIDENT)
                    ts = random_ts(incident_current, minute_end)
                    message, error_type, stack_trace = gen_log_message(service, level)
                    doc = {
                        "@timestamp": iso(ts),
                        "service.name": service,
                        "log.level": level,
                        "message": message,
                        "trace.id": random.choice(trace_pool),
                        "host.name": host,
                    }
                    if error_type:
                        doc["error.type"] = error_type
                    if stack_trace:
                        doc["error.stack_trace"] = stack_trace
                    docs.append(doc)
            elif service == "api-gateway" and incident_current >= datetime(2026, 2, 22, 14, 32, tzinfo=timezone.utc):
                # Cascading: api-gateway timeouts
                for _ in range(random.randint(20, 40)):
                    host = random.choice(SERVICE_HOSTS[service])
                    level = random.choice(["error", "error", "warn"])
                    ts = random_ts(incident_current, minute_end)
                    message, error_type, stack_trace = gen_log_message(service, level)
                    doc = {
                        "@timestamp": iso(ts),
                        "service.name": service,
                        "log.level": level,
                        "message": message,
                        "trace.id": random.choice(trace_pool),
                        "host.name": host,
                    }
                    if error_type:
                        doc["error.type"] = error_type
                    if stack_trace:
                        doc["error.stack_trace"] = stack_trace
                    docs.append(doc)
            elif service == "notification-service" and incident_current >= datetime(2026, 2, 22, 14, 35, tzinfo=timezone.utc):
                # Cascading: notification-service timeouts
                for _ in range(random.randint(10, 20)):
                    host = random.choice(SERVICE_HOSTS[service])
                    level = random.choice(["error", "warn"])
                    ts = random_ts(incident_current, minute_end)
                    message, error_type, stack_trace = gen_log_message(service, level)
                    doc = {
                        "@timestamp": iso(ts),
                        "service.name": service,
                        "log.level": level,
                        "message": message,
                        "trace.id": random.choice(trace_pool),
                        "host.name": host,
                    }
                    if error_type:
                        doc["error.type"] = error_type
                    if stack_trace:
                        doc["error.stack_trace"] = stack_trace
                    docs.append(doc)
            else:
                # Normal rate for other services during incident
                for _ in range(random.randint(5, 10)):
                    host = random.choice(SERVICE_HOSTS[service])
                    level = pick_level(LOG_LEVELS_NORMAL)
                    ts = random_ts(incident_current, minute_end)
                    message, error_type, stack_trace = gen_log_message(service, level)
                    doc = {
                        "@timestamp": iso(ts),
                        "service.name": service,
                        "log.level": level,
                        "message": message,
                        "trace.id": random.choice(trace_pool),
                        "host.name": host,
                    }
                    if error_type:
                        doc["error.type"] = error_type
                    if stack_trace:
                        doc["error.stack_trace"] = stack_trace
                    docs.append(doc)
        incident_current += timedelta(minutes=1)

    print(f"  Logs generated: {len(docs)}")
    return docs


def generate_metrics() -> list[dict]:
    """Generate ~14K metric data points: 1-min intervals, 10 hosts, 24h + incident."""
    docs = []

    # Service to host mapping for latency metrics
    host_service = {}
    for svc, hosts in SERVICE_HOSTS.items():
        for h in hosts:
            host_service[h] = svc

    # Baseline: 24 hours, 10 hosts, 1-min intervals = 24*60*10 = 14400
    current = BASELINE_START
    while current < POST_INCIDENT:
        for host in HOSTS:
            service = host_service.get(host, "unknown")

            # Normal ranges
            cpu = random.uniform(0.10, 0.40)
            mem = random.uniform(0.30, 0.60)
            latency = random.uniform(50, 200)
            status_code = random.choices([200, 201, 204, 400, 404, 500], weights=[80, 5, 5, 5, 3, 2])[0]
            request_count = random.randint(50, 200)

            # Incident window anomalies
            if INCIDENT_START <= current <= INCIDENT_END:
                if host == "node-3" and current >= datetime(2026, 2, 22, 14, 30, tzinfo=timezone.utc):
                    cpu = random.uniform(0.85, 0.95)
                    mem = random.uniform(0.70, 0.85)
                elif host == "node-7" and current >= datetime(2026, 2, 22, 14, 30, tzinfo=timezone.utc):
                    cpu = random.uniform(0.70, 0.80)
                    mem = random.uniform(0.65, 0.75)

                if service == "payment-service" and current >= datetime(2026, 2, 22, 14, 30, tzinfo=timezone.utc):
                    latency = random.uniform(1500, 5000)
                    status_code = random.choices([200, 500, 502, 503], weights=[20, 40, 20, 20])[0]
                elif service == "api-gateway" and current >= datetime(2026, 2, 22, 14, 32, tzinfo=timezone.utc):
                    latency = random.uniform(1500, 3000)
                    status_code = random.choices([200, 502, 503, 504], weights=[30, 30, 20, 20])[0]
                elif service == "notification-service" and current >= datetime(2026, 2, 22, 14, 35, tzinfo=timezone.utc):
                    latency = random.uniform(800, 2000)

            docs.append({
                "@timestamp": iso(current),
                "host.name": host,
                "service.name": service,
                "system.cpu.total.pct": round(cpu, 4),
                "system.memory.used.pct": round(mem, 4),
                "http.response.latency_ms": round(latency, 2),
                "http.response.status_code": status_code,
                "http.request.count": request_count,
            })

        current += timedelta(minutes=1)

    print(f"  Metrics generated: {len(docs)}")
    return docs


def generate_security_alerts() -> list[dict]:
    """Generate ~250 security events: baseline + brute-force incident."""
    docs = []
    normal_ips = [fake.ipv4_public() for _ in range(30)]
    dest_ips = [f"10.0.{random.randint(1, 5)}.{random.randint(1, 254)}" for _ in range(10)]

    # Baseline: ~8-10/hour for 24 hours = ~200
    current = BASELINE_START
    while current < INCIDENT_START:
        for _ in range(random.randint(8, 10)):
            rule_name, category, severity = random.choice(SECURITY_RULES_NORMAL)
            ts = random_ts(current, current + timedelta(hours=1))
            docs.append({
                "@timestamp": iso(ts),
                "event.category": category,
                "event.action": rule_name,
                "source.ip": random.choice(normal_ips),
                "destination.ip": random.choice(dest_ips),
                "user.name": fake.user_name(),
                "alert.severity": severity,
                "alert.rule_name": rule_name,
                "message": f"Security event: {rule_name} from {random.choice(normal_ips)}",
            })
        current += timedelta(hours=1)

    # Incident: brute-force from 203.0.113.42 starting at 14:25
    brute_start = INCIDENT_START
    brute_end = INCIDENT_END
    current = brute_start
    while current < brute_end:
        minute_end = current + timedelta(minutes=1)
        # 2-3 brute-force attempts per minute
        for _ in range(random.randint(2, 3)):
            ts = random_ts(current, minute_end)
            docs.append({
                "@timestamp": iso(ts),
                "event.category": "authentication",
                "event.action": "login_attempt",
                "source.ip": BRUTE_FORCE_IP,
                "destination.ip": "10.0.1.100",
                "user.name": random.choice(["admin", "root", "deploy", "sre-bot", fake.user_name()]),
                "alert.severity": "high",
                "alert.rule_name": "brute_force_login",
                "message": f"Failed login attempt from {BRUTE_FORCE_IP} targeting user-service",
            })
        # Also a few normal events during incident
        if random.random() < 0.3:
            rule_name, category, severity = random.choice(SECURITY_RULES_NORMAL)
            ts = random_ts(current, minute_end)
            docs.append({
                "@timestamp": iso(ts),
                "event.category": category,
                "event.action": rule_name,
                "source.ip": random.choice(normal_ips),
                "destination.ip": random.choice(dest_ips),
                "user.name": fake.user_name(),
                "alert.severity": severity,
                "alert.rule_name": rule_name,
                "message": f"Security event: {rule_name}",
            })
        current += timedelta(minutes=1)

    print(f"  Security alerts generated: {len(docs)}")
    return docs


def generate_deployments() -> list[dict]:
    """Generate ~20 deployment records including the v2.4.1 incident trigger."""
    docs = []
    versions = ["v2.3.8", "v2.3.9", "v2.4.0", "v1.12.3", "v1.12.4", "v3.1.0", "v3.1.1"]

    # Baseline deployments: 1-2 per day for the baseline period
    for day_offset in range(2):
        day = BASELINE_START + timedelta(days=day_offset)
        for _ in range(random.randint(1, 3)):
            service = random.choice(SERVICES)
            ts = random_ts(day, day + timedelta(hours=12))
            docs.append({
                "@timestamp": iso(ts),
                "deployment.version": random.choice(versions),
                "deployment.service": service,
                "deployment.author": random.choice(["deploy-bot", fake.user_name(), "ci-pipeline"]),
                "deployment.status": "success",
                "deployment.commit_sha": fake.sha1()[:12],
                "deployment.changes": f"Update {service}: {fake.sentence(nb_words=6)}",
            })

    # The critical deployment: v2.4.1 of payment-service at 14:28
    docs.append({
        "@timestamp": "2026-02-22T14:28:00.000Z",
        "deployment.version": "v2.4.1",
        "deployment.service": "payment-service",
        "deployment.author": "deploy-bot",
        "deployment.status": "success",
        "deployment.commit_sha": "a1b2c3d4e5f6",
        "deployment.changes": "Update payment-service: Fix payment retry logic and add new payment provider integration",
    })

    # A few more normal deployments on the incident day before the incident
    for _ in range(random.randint(3, 5)):
        service = random.choice([s for s in SERVICES if s != "payment-service"])
        ts = random_ts(
            datetime(2026, 2, 22, 6, 0, tzinfo=timezone.utc),
            datetime(2026, 2, 22, 13, 0, tzinfo=timezone.utc),
        )
        docs.append({
            "@timestamp": iso(ts),
            "deployment.version": random.choice(versions),
            "deployment.service": service,
            "deployment.author": random.choice(["deploy-bot", "ci-pipeline"]),
            "deployment.status": "success",
            "deployment.commit_sha": fake.sha1()[:12],
            "deployment.changes": f"Update {service}: {fake.sentence(nb_words=6)}",
        })

    # Pad to at least 15 deployments
    while len(docs) < 15:
        service = random.choice(SERVICES)
        ts = random_ts(BASELINE_START, BASELINE_END)
        docs.append({
            "@timestamp": iso(ts),
            "deployment.version": random.choice(versions),
            "deployment.service": service,
            "deployment.author": random.choice(["deploy-bot", "ci-pipeline", fake.user_name()]),
            "deployment.status": "success",
            "deployment.commit_sha": fake.sha1()[:12],
            "deployment.changes": f"Update {service}: {fake.sentence(nb_words=6)}",
        })

    print(f"  Deployments generated: {len(docs)}")
    return docs


def generate_threat_intel() -> list[dict]:
    """Generate 50 threat intelligence entries including the brute-force IP."""
    docs = []

    # Known bad IPs including our attacker
    bad_ips = [BRUTE_FORCE_IP] + [fake.ipv4_public() for _ in range(29)]

    for i, ip in enumerate(bad_ips):
        actor = random.choice(THREAT_ACTORS)
        severity = random.choice(["critical", "high", "medium"])
        docs.append({
            "indicator.ip": ip,
            "indicator.type": random.choice(["ipv4-addr", "domain-name"]),
            "threat.description": (
                f"Known malicious IP {ip} associated with {actor}. "
                f"Observed conducting {random.choice(['brute-force attacks', 'data exfiltration', 'command and control communications', 'vulnerability scanning', 'credential stuffing'])} "
                f"targeting {random.choice(['financial services', 'cloud infrastructure', 'web applications', 'authentication endpoints'])}. "
                f"First observed {fake.date_between(start_date='-1y', end_date='-1m')}."
            ),
            "threat.severity": severity,
            "threat.actor": actor,
            "cve.id": f"CVE-{random.randint(2023, 2026)}-{random.randint(10000, 99999)}" if random.random() < 0.4 else None,
            "last_seen": iso(random_ts(
                datetime(2026, 1, 1, tzinfo=timezone.utc),
                datetime(2026, 2, 22, tzinfo=timezone.utc),
            )),
        })

    # Additional CVE-only entries
    for _ in range(20):
        docs.append({
            "indicator.ip": fake.ipv4_public(),
            "indicator.type": "ipv4-addr",
            "threat.description": (
                f"Threat actor {random.choice(THREAT_ACTORS)} exploiting "
                f"CVE-{random.randint(2024, 2026)}-{random.randint(10000, 99999)} for "
                f"{random.choice(['remote code execution', 'privilege escalation', 'SQL injection', 'cross-site scripting'])} "
                f"against {random.choice(['payment gateways', 'API endpoints', 'authentication services', 'database servers'])}."
            ),
            "threat.severity": random.choice(["critical", "high", "medium", "low"]),
            "threat.actor": random.choice(THREAT_ACTORS),
            "cve.id": f"CVE-{random.randint(2024, 2026)}-{random.randint(10000, 99999)}",
            "last_seen": iso(random_ts(
                datetime(2026, 1, 1, tzinfo=timezone.utc),
                datetime(2026, 2, 22, tzinfo=timezone.utc),
            )),
        })

    # Filter out None cve.id fields
    for doc in docs:
        if doc.get("cve.id") is None:
            del doc["cve.id"]

    print(f"  Threat intel generated: {len(docs)}")
    return docs


def generate_resolved_incidents() -> list[dict]:
    """Generate historical resolved incidents for semantic similarity search."""
    return [
        {
            "@timestamp": "2026-02-15T10:30:00.000Z",
            "incident.id": "IC-2026-001",
            "incident.severity": "P1",
            "incident.status": "resolved",
            "incident.title": "Payment service cascade failure after deployment",
            "incident.root_cause": "Deployment v2.3.5 of payment-service introduced a connection pool exhaustion bug. The new payment provider integration held connections open without timeout, causing upstream services (api-gateway, notification-service) to fail with UpstreamTimeoutException. Resolved by rolling back to v2.3.4.",
            "incident.remediation": "Rolled back payment-service to v2.3.4. Added connection pool timeout of 30s. Created Jira ticket for proper fix.",
            "incident.agents_involved": ["triage", "log-analyzer", "metrics"],
        },
        {
            "@timestamp": "2026-02-10T08:15:00.000Z",
            "incident.id": "IC-2026-002",
            "incident.severity": "P2",
            "incident.status": "resolved",
            "incident.title": "Brute force attack from Eastern European botnet",
            "incident.root_cause": "Coordinated brute-force login attempts from IP range 203.0.113.0/24 targeting user-service authentication endpoint. Over 5000 attempts in 30 minutes. No successful breaches detected but caused elevated CPU on auth servers.",
            "incident.remediation": "Blocked IP range 203.0.113.0/24 at WAF level. Enabled rate limiting on /auth/login endpoint. Forced password reset for accounts with failed attempts.",
            "incident.agents_involved": ["triage", "security"],
        },
        {
            "@timestamp": "2026-02-05T16:00:00.000Z",
            "incident.id": "IC-2026-003",
            "incident.severity": "P2",
            "incident.status": "resolved",
            "incident.title": "Memory leak in inventory-service causing OOM kills",
            "incident.root_cause": "Memory leak in inventory-service cache layer. Redis connection objects were not being returned to pool after timeout errors. Memory grew linearly until OOM kill at 90% utilization.",
            "incident.remediation": "Restarted affected pods. Deployed hotfix v1.8.3 with proper connection cleanup in finally blocks. Added memory usage alerting at 70% threshold.",
            "incident.agents_involved": ["triage", "metrics"],
        },
        {
            "@timestamp": "2026-01-28T11:45:00.000Z",
            "incident.id": "IC-2026-004",
            "incident.severity": "P1",
            "incident.status": "resolved",
            "incident.title": "Database connection storm after config change",
            "incident.root_cause": "Configuration change reduced database connection pool from 50 to 5 connections per pod. Under normal load this was sufficient, but during peak traffic all connections were exhausted causing 500 errors across payment-service and user-service.",
            "incident.remediation": "Reverted config change. Set connection pool to 100 with 30s idle timeout. Added load testing gate to config change pipeline.",
            "incident.agents_involved": ["triage", "log-analyzer", "metrics"],
        },
        {
            "@timestamp": "2026-01-20T09:30:00.000Z",
            "incident.id": "IC-2026-005",
            "incident.severity": "P3",
            "incident.status": "resolved",
            "incident.title": "SSL certificate expiry causing intermittent 502s",
            "incident.root_cause": "Internal service mesh SSL certificate expired on 3 of 10 nodes. Affected nodes returned 502 errors intermittently when load balancer routed to them. Certificate auto-renewal cron job had been disabled during maintenance.",
            "incident.remediation": "Manually renewed certificates on affected nodes. Re-enabled auto-renewal cron. Added certificate expiry monitoring with 30-day warning threshold.",
            "incident.agents_involved": ["triage", "log-analyzer"],
        },
    ]


def main():
    es = Elasticsearch(
        os.environ["ELASTICSEARCH_URL"],
        api_key=os.environ["API_KEY"],
    )

    print("=== Incident Cortex: Synthetic Data Generation ===\n")

    # Load index mappings
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    mappings_path = os.path.join(project_dir, "data", "index_mappings.json")

    with open(mappings_path) as f:
        all_mappings = json.load(f)

    # Create indices (delete if exists for idempotency)
    print("[1/8] Creating indices...")
    for index_name, index_config in all_mappings.items():
        if es.indices.exists(index=index_name):
            es.indices.delete(index=index_name)
            print(f"  Deleted existing index: {index_name}")
        es.indices.create(index=index_name, body=index_config)
        print(f"  Created index: {index_name}")

    # Generate data
    print("\n[2/8] Generating logs...")
    logs = generate_logs()

    print("[3/8] Generating metrics...")
    metrics = generate_metrics()

    print("[4/8] Generating security alerts...")
    security = generate_security_alerts()

    print("[5/8] Generating deployments...")
    deployments = generate_deployments()

    print("[6/8] Generating threat intelligence...")
    threat_intel = generate_threat_intel()

    # Bulk index
    def make_actions(index: str, docs: list[dict]):
        for doc in docs:
            yield {"_index": index, "_source": doc}

    print("[7/8] Generating resolved incidents...")
    resolved_incidents = generate_resolved_incidents()
    print(f"  Resolved incidents generated: {len(resolved_incidents)}")

    print("\n[8/8] Indexing data...")

    indexed, errors = bulk(es, make_actions("ic-logs", logs), refresh="wait_for")
    print(f"  Logs indexed: {indexed} (errors: {len(errors)})")

    indexed, errors = bulk(es, make_actions("ic-metrics", metrics), refresh="wait_for")
    print(f"  Metrics indexed: {indexed} (errors: {len(errors)})")

    indexed, errors = bulk(es, make_actions("ic-security-alerts", security), refresh="wait_for")
    print(f"  Security alerts indexed: {indexed} (errors: {len(errors)})")

    indexed, errors = bulk(es, make_actions("ic-deployments", deployments), refresh="wait_for")
    print(f"  Deployments indexed: {indexed} (errors: {len(errors)})")

    # Threat intel needs longer timeout for semantic_text ELSER processing
    print("  Indexing threat intel (semantic_text -- may take a minute for ELSER)...")
    indexed, errors = bulk(
        es,
        make_actions("ic-threat-intel", threat_intel),
        refresh="wait_for",
        request_timeout=300,
    )
    print(f"  Threat intel indexed: {indexed} (errors: {len(errors)})")

    # Recreate ic-incidents with semantic_text mapping for similarity search
    print("  Recreating ic-incidents with semantic_text mapping...")
    if es.indices.exists(index="ic-incidents"):
        es.indices.delete(index="ic-incidents")
    es.indices.create(index="ic-incidents", body={
        "mappings": {
            "properties": {
                "@timestamp": {"type": "date"},
                "incident.id": {"type": "keyword"},
                "incident.severity": {"type": "keyword"},
                "incident.status": {"type": "keyword"},
                "incident.title": {"type": "text"},
                "incident.root_cause": {"type": "semantic_text"},
                "incident.remediation": {"type": "text"},
                "incident.agents_involved": {"type": "keyword"},
                "incident.timeline": {"type": "nested"},
            }
        }
    })
    print("  Indexing resolved incidents (semantic_text -- may take a minute for ELSER)...")
    for doc in resolved_incidents:
        es.index(index="ic-incidents", document=doc, request_timeout=120)
    print(f"  Resolved incidents indexed: {len(resolved_incidents)}")

    # Verify counts
    print("\n=== Final Counts ===")
    for index_name in all_mappings:
        count = es.count(index=index_name)["count"]
        print(f"  {index_name}: {count}")

    print("\n=== Data generation complete! ===")
    es.close()


if __name__ == "__main__":
    main()

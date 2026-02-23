import type { AgentInfo, AgentId } from "./types";

export const AGENTS: Record<AgentId, AgentInfo> = {
  "incident-cortex-triage": {
    id: "incident-cortex-triage",
    name: "Triage Agent",
    shortName: "Triage",
    symbol: "TR",
    color: "#FF6B6B",
    description:
      "Coordinator: classifies incidents, dispatches specialists, synthesizes RCA",
  },
  "incident-cortex-log-analyzer": {
    id: "incident-cortex-log-analyzer",
    name: "Log Analyzer",
    shortName: "Logs",
    symbol: "LA",
    color: "#4ECDC4",
    description:
      "Deep log analysis: error patterns, traces, first occurrences",
  },
  "incident-cortex-metrics": {
    id: "incident-cortex-metrics",
    name: "Metrics Analyzer",
    shortName: "Metrics",
    symbol: "MA",
    color: "#45B7D1",
    description:
      "Infrastructure: CPU/memory/latency anomalies, deployment correlation",
  },
  "incident-cortex-security": {
    id: "incident-cortex-security",
    name: "Security Analyst",
    shortName: "Security",
    symbol: "SA",
    color: "#F7DC6F",
    description:
      "Threats: brute-force, suspicious IPs, threat intelligence",
  },
};

export const COLORS = {
  bgPrimary: "#1D1E24",
  bgPanel: "#25262E",
  bgCard: "#2C2D35",
  bgInput: "#343741",
  textPrimary: "#DFE5EF",
  textSecondary: "#98A2B3",
  textSubdued: "#69707D",
  elasticBlue: "#0077CC",
  success: "#00BFB3",
  warning: "#FEC514",
  danger: "#FF6666",
  accent: "#B298DC",
  border: "#343741",
} as const;

export const TOOL_LABELS: Record<string, string> = {
  "ic-find-error-spike": "Find Error Spike",
  "ic-correlate-trace": "Correlate Trace",
  "ic-find-first-occurrence": "Find First Occurrence",
  "ic-detect-metric-anomaly": "Detect Metric Anomaly",
  "ic-correlate-deploy-metric": "Correlate Deploy vs Metrics",
  "ic-check-security-alerts": "Check Security Alerts",
  "ic-investigate-ip": "Investigate Suspicious IP",
  "ic-get-deployments": "Get Recent Deployments",
  "ic-search-similar-incidents": "Search Similar Incidents",
  "ic-service-health-overview": "Service Health Overview",
  "notify-slack": "Notify Slack",
  "create-jira-ticket": "Create Jira Ticket",
  "rollback-deployment": "Rollback Deployment",
  "block-ip": "Block Suspicious IP",
  "index-incident-report": "Index Incident Report",
};

export const REMEDIATION_TOOL_IDS = new Set([
  "rollback-deployment",
  "block-ip",
  "notify-slack",
  "create-jira-ticket",
  "index-incident-report",
]);

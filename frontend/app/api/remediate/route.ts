import { NextRequest, NextResponse } from "next/server";
import type { RemediationAction, RemediationResult } from "@/lib/types";

interface RemediateRequest {
  actions: RemediationAction[];
  decision: "approved" | "rejected";
}

interface ESIndexResponse {
  _id: string;
  result: string;
}

function buildDocument(
  action: RemediationAction
): Record<string, unknown> {
  const base = {
    "@timestamp": new Date().toISOString(),
  };

  switch (action.toolId) {
    case "ic-notify-slack":
    case "notify-slack":
      return {
        ...base,
        type: "slack_notification",
        channel: "#incident-response",
        severity: "high",
        message: action.label,
      };

    case "ic-create-jira-ticket":
    case "create-jira-ticket":
      return {
        ...base,
        type: "jira_ticket",
        ticket: {
          id: `IC-${Date.now()}`,
          url: `https://jira.example.com/browse/IC-${Date.now()}`,
        },
        message: action.label,
        severity: "high",
      };

    case "ic-rollback-deployment":
    case "rollback-deployment":
      return {
        ...base,
        type: "deployment_rollback",
        action: "rollback",
        deployment: {
          service: "unknown",
          version: "previous",
        },
        message: action.label,
      };

    case "ic-block-ip":
    case "block-ip":
      return {
        ...base,
        type: "ip_block",
        action: "block",
        target: {
          ip: "0.0.0.0",
        },
        message: action.label,
      };

    case "ic-index-incident-report":
    case "index-incident-report":
      return {
        ...base,
        type: "incident_report",
        message: action.label,
        severity: "high",
      };

    default:
      return {
        ...base,
        type: "remediation_action",
        action: action.toolId,
        message: action.label,
      };
  }
}

async function indexDocument(
  esUrl: string,
  apiKey: string,
  doc: Record<string, unknown>
): Promise<ESIndexResponse> {
  const response = await fetch(
    `${esUrl}/ic-notifications/_doc?refresh=wait_for`,
    {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(doc),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Elasticsearch indexing failed (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<ESIndexResponse>;
}

export async function POST(req: NextRequest) {
  const esUrl = process.env.ELASTICSEARCH_URL;
  const apiKey = process.env.API_KEY;

  if (!esUrl || !apiKey) {
    return NextResponse.json(
      { error: "Missing ELASTICSEARCH_URL or API_KEY environment variables" },
      { status: 500 }
    );
  }

  let body: RemediateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { actions, decision } = body;

  if (!actions || !Array.isArray(actions) || !decision) {
    return NextResponse.json(
      { error: "Request must include actions array and decision" },
      { status: 400 }
    );
  }

  if (decision === "rejected") {
    const overrideDoc = {
      "@timestamp": new Date().toISOString(),
      type: "remediation_override",
      decision: "rejected",
      actions: actions.map((a) => ({
        id: a.id,
        toolId: a.toolId,
        label: a.label,
      })),
      message: `Operator rejected ${actions.length} remediation action(s)`,
    };

    try {
      await indexDocument(esUrl, apiKey, overrideDoc);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to index rejection record",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ status: "rejected", executed: [] });
  }

  const executed: RemediationResult[] = [];

  for (const action of actions) {
    const doc = buildDocument(action);
    try {
      const result = await indexDocument(esUrl, apiKey, doc);
      executed.push({
        actionId: action.id,
        toolId: action.toolId,
        success: true,
        docId: result._id,
      });
    } catch {
      executed.push({
        actionId: action.id,
        toolId: action.toolId,
        success: false,
        docId: null,
      });
    }
  }

  return NextResponse.json({ status: "approved", executed });
}

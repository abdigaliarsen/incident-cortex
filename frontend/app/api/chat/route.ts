import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { message, agentId, conversationId } = await req.json();

  const kibanaUrl = process.env.KIBANA_URL;
  const apiKey = process.env.API_KEY;

  if (!kibanaUrl || !apiKey) {
    return NextResponse.json(
      { error: "Missing KIBANA_URL or API_KEY environment variables" },
      { status: 500 }
    );
  }

  const response = await fetch(`${kibanaUrl}/api/agent_builder/converse`, {
    method: "POST",
    headers: {
      Authorization: `ApiKey ${apiKey}`,
      "kbn-xsrf": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: message,
      agent_id: agentId || "incident-cortex-triage",
      ...(conversationId && { conversation_id: conversationId }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Agent Builder error: ${response.status}`, detail: errorText },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}

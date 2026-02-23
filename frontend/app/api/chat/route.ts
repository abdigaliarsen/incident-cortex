import { NextRequest, NextResponse } from "next/server";
import type { ConverseResponse, SSEEvent } from "@/lib/types";

export const maxDuration = 60;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Create a ReadableStream that emits all SSE events then closes */
function sseStream(events: SSEEvent[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      }
      controller.close();
    },
  });
}

function syntheticSSEFromJSON(
  data: ConverseResponse
): ReadableStream<Uint8Array> {
  const events: SSEEvent[] = [];

  events.push({
    type: "conversation_id_set",
    conversation_id: data.conversation_id,
  });

  for (const step of data.steps || []) {
    if (step.type === "reasoning" && step.reasoning) {
      events.push({ type: "reasoning", reasoning: step.reasoning });
    }

    if (step.type === "tool_call" && step.tool_id) {
      events.push({
        type: "tool_call",
        tool_id: step.tool_id,
        tool_call_id: step.tool_call_id,
        params: step.params,
      });
      const resultData = step.results?.[0]?.data;
      events.push({
        type: "tool_result",
        tool_call_id: step.tool_call_id,
        tool_id: step.tool_id,
        result: resultData ? JSON.stringify(resultData) : undefined,
      });
    }

    for (const tc of step.tool_calls || []) {
      events.push({
        type: "tool_call",
        tool_id: tc.tool_id,
        params: tc.tool_params,
      });
      events.push({
        type: "tool_result",
        tool_id: tc.tool_id,
        result: tc.result,
      });
    }
  }

  events.push({
    type: "message_complete",
    message: data.response?.message || "No response",
  });

  events.push({ type: "round_complete" });

  return sseStream(events);
}

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

  const body = JSON.stringify({
    input: message,
    agent_id: agentId || "incident-cortex-triage",
    ...(conversationId && { conversation_id: conversationId }),
  });

  const headers = {
    Authorization: `ApiKey ${apiKey}`,
    "kbn-xsrf": "true",
    "Content-Type": "application/json",
  };

  const response = await fetch(`${kibanaUrl}/api/agent_builder/converse`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Agent Builder error: ${response.status}`, detail: errorText },
      { status: response.status }
    );
  }

  const data: ConverseResponse = await response.json();
  return new Response(syntheticSSEFromJSON(data), { headers: SSE_HEADERS });
}

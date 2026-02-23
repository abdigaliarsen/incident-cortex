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

/** Map a Kibana SSE event (event type + nested data payload) to our frontend SSEEvent format */
function mapKibanaEvent(
  eventType: string,
  payload: Record<string, unknown>
): SSEEvent | null {
  switch (eventType) {
    case "conversation_id_set":
      return {
        type: "conversation_id_set",
        conversation_id: payload.conversation_id as string,
      };
    case "reasoning":
      return { type: "reasoning", reasoning: payload.reasoning as string };
    case "thinking_complete":
      return { type: "thinking_complete" };
    case "tool_call":
      return {
        type: "tool_call",
        tool_id: payload.tool_id as string,
        tool_call_id: payload.tool_call_id as string,
        params: (payload.params || payload.tool_params) as
          | Record<string, string>
          | undefined,
      };
    case "tool_progress":
      return { type: "tool_progress", tool_id: payload.tool_id as string };
    case "tool_result":
      return {
        type: "tool_result",
        tool_call_id: payload.tool_call_id as string,
        tool_id: payload.tool_id as string,
        result:
          typeof payload.result === "string"
            ? payload.result
            : JSON.stringify(payload.result),
      };
    case "message_chunk":
      return { type: "message_chunk", chunk: payload.text_chunk as string };
    case "message_complete":
      return {
        type: "message_complete",
        message: payload.message_content as string,
      };
    case "round_complete":
      return { type: "round_complete" };
    default:
      return null;
  }
}

/** Parse raw Kibana SSE text into frontend SSEEvent array */
function parseKibanaSSE(raw: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const parts = raw.split("\n\n");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith(":")) continue;

    let eventType = "";
    let dataStr = "";
    for (const line of trimmed.split("\n")) {
      if (line.startsWith("event: ")) eventType = line.slice(7);
      else if (line.startsWith("data: ")) dataStr = line.slice(6);
    }
    if (!eventType || !dataStr) continue;

    try {
      const parsed = JSON.parse(dataStr);
      const payload = parsed.data || parsed;
      const mapped = mapKibanaEvent(eventType, payload);
      if (mapped) events.push(mapped);
    } catch {
      // Skip malformed events
    }
  }

  return events;
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

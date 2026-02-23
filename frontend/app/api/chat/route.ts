import { NextRequest, NextResponse } from "next/server";
import type { SSEEvent } from "@/lib/types";

export const maxDuration = 120;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Transform a Kibana SSE event into our frontend SSEEvent format.
 * Kibana format: `event: <type>\ndata: {"data": {...}}`
 * Our format:   `data: {"type": "<type>", ...}`
 */
function transformKibanaEvent(
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
      return {
        type: "reasoning",
        reasoning: payload.reasoning as string,
      };

    case "tool_call": {
      const toolId = payload.tool_id as string;
      const event: SSEEvent = {
        type: "tool_call",
        tool_id: toolId,
        tool_call_id: payload.tool_call_id as string,
        params: payload.params as Record<string, string>,
      };
      return event;
    }

    case "tool_result": {
      const results = payload.results as
        | { type: string; data: Record<string, unknown> }[]
        | undefined;
      const resultData = results?.[0]?.data;
      return {
        type: "tool_result",
        tool_call_id: payload.tool_call_id as string,
        tool_id: payload.tool_id as string,
        result: resultData ? JSON.stringify(resultData) : undefined,
      };
    }

    case "thinking_complete":
      return { type: "thinking_complete" };

    case "message_chunk":
      return {
        type: "message_chunk",
        chunk: payload.text_chunk as string,
      };

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

/**
 * Parse the Kibana SSE stream and re-emit as our simplified SSE format.
 * Handles: `event: <type>`, `data: {"data":{...}}`, `: comments`, keep-alive.
 */
function proxyKibanaSSE(
  kibanaBody: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let buffer = "";
  let currentEventType = "";

  return new ReadableStream({
    async start(controller) {
      const reader = kibanaBody.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE blocks (separated by double newlines)
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            if (!block.trim()) continue;

            for (const line of block.split("\n")) {
              if (line.startsWith("event: ")) {
                currentEventType = line.slice(7).trim();
              } else if (line.startsWith("data: ")) {
                const jsonStr = line.slice(6);
                try {
                  const parsed = JSON.parse(jsonStr);
                  const payload = parsed.data || parsed;
                  const sseEvent = transformKibanaEvent(
                    currentEventType,
                    payload
                  );
                  if (sseEvent) {
                    controller.enqueue(encoder.encode(encodeSSE(sseEvent)));

                    // Emit sub_agent_call for tool_calls targeting agent IDs
                    if (
                      sseEvent.type === "tool_call" &&
                      sseEvent.tool_id?.startsWith("incident-cortex-")
                    ) {
                      controller.enqueue(
                        encoder.encode(
                          encodeSSE({
                            type: "sub_agent_call",
                            sub_agent_id: sseEvent.tool_id,
                          })
                        )
                      );
                    }
                  }
                } catch {
                  // Skip malformed JSON
                }
                currentEventType = "";
              }
              // Ignore comment lines (`: ...`) and keep-alive
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                const payload = parsed.data || parsed;
                const sseEvent = transformKibanaEvent(
                  currentEventType,
                  payload
                );
                if (sseEvent) {
                  controller.enqueue(encoder.encode(encodeSSE(sseEvent)));
                }
              } catch {
                // Skip malformed
              }
            }
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            encodeSSE({
              type: "message_complete",
              message: `Stream error: ${err instanceof Error ? err.message : "Unknown"}`,
            })
          )
        );
        controller.enqueue(
          encoder.encode(encodeSSE({ type: "round_complete" }))
        );
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
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

  const response = await fetch(
    `${kibanaUrl}/api/agent_builder/converse/async`,
    { method: "POST", headers, body }
  );

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Agent Builder error: ${response.status}`, detail: errorText },
      { status: response.status }
    );
  }

  if (!response.body) {
    return NextResponse.json(
      { error: "No response body from Agent Builder" },
      { status: 502 }
    );
  }

  return new Response(proxyKibanaSSE(response.body), { headers: SSE_HEADERS });
}

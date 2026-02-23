import { NextRequest, NextResponse } from "next/server";
import type { ConverseResponse, SSEEvent } from "@/lib/types";

export const maxDuration = 120;

function syntheticSSEFromJSON(data: ConverseResponse): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  function encode(event: SSEEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  return new ReadableStream({
    start(controller) {
      // conversation_id_set
      controller.enqueue(
        encode({ type: "conversation_id_set", conversation_id: data.conversation_id })
      );

      // Emit tool_call / tool_result for each step
      for (const step of data.steps || []) {
        if (step.type === "reasoning" && step.reasoning) {
          controller.enqueue(encode({ type: "reasoning", reasoning: step.reasoning }));
        }

        if (step.type === "tool_call" && step.tool_id) {
          controller.enqueue(
            encode({
              type: "tool_call",
              tool_id: step.tool_id,
              tool_call_id: step.tool_call_id,
              params: step.params,
            })
          );
          const resultData = step.results?.[0]?.data;
          controller.enqueue(
            encode({
              type: "tool_result",
              tool_call_id: step.tool_call_id,
              tool_id: step.tool_id,
              result: resultData ? JSON.stringify(resultData) : undefined,
            })
          );
        }

        // Handle nested tool_calls format
        for (const tc of step.tool_calls || []) {
          controller.enqueue(
            encode({
              type: "tool_call",
              tool_id: tc.tool_id,
              params: tc.tool_params,
            })
          );
          controller.enqueue(
            encode({
              type: "tool_result",
              tool_id: tc.tool_id,
              result: tc.result,
            })
          );
        }
      }

      // message_complete with full response
      controller.enqueue(
        encode({
          type: "message_complete",
          message: data.response?.message || "No response",
        })
      );

      // round_complete
      controller.enqueue(encode({ type: "round_complete" }));

      controller.close();
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

  // Try streaming endpoint first
  try {
    const asyncResp = await fetch(`${kibanaUrl}/api/agent_builder/converse/async`, {
      method: "POST",
      headers: { ...headers, Accept: "text/event-stream" },
      body,
    });

    if (asyncResp.ok && asyncResp.headers.get("content-type")?.includes("text/event-stream")) {
      // Pipe the SSE stream directly to the client
      return new Response(asyncResp.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // If async endpoint returned non-SSE 200 (JSON), treat as blocking response
    if (asyncResp.ok) {
      const data: ConverseResponse = await asyncResp.json();
      return new Response(syntheticSSEFromJSON(data), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // If 404/405, fall through to blocking endpoint
    if (asyncResp.status !== 404 && asyncResp.status !== 405) {
      const errorText = await asyncResp.text();
      return NextResponse.json(
        { error: `Agent Builder error: ${asyncResp.status}`, detail: errorText },
        { status: asyncResp.status }
      );
    }
  } catch {
    // Network error on async endpoint — fall through to blocking
  }

  // Fallback: blocking /converse endpoint -> synthetic SSE
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
  return new Response(syntheticSSEFromJSON(data), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

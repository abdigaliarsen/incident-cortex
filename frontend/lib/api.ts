import type { AgentId, SSEEvent, ConverseResponse } from "./types";

export async function* streamMessage(
  message: string,
  agentId: AgentId = "incident-cortex-triage",
  conversationId?: string
): AsyncGenerator<SSEEvent> {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, agentId, conversationId }),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(error.detail || error.error || "Request failed");
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double newlines (SSE event boundaries)
      const parts = buffer.split("\n\n");
      // Keep the last incomplete part in the buffer
      buffer = parts.pop() || "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // Extract data from SSE line(s)
        for (const line of trimmed.split("\n")) {
          if (line.startsWith("data: ")) {
            const json = line.slice(6);
            try {
              yield JSON.parse(json) as SSEEvent;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.trim().split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6)) as SSEEvent;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Backward-compatible wrapper that collects all events and returns final response */
export async function sendMessage(
  message: string,
  agentId: AgentId = "incident-cortex-triage",
  conversationId?: string
): Promise<ConverseResponse> {
  const events: SSEEvent[] = [];
  for await (const event of streamMessage(message, agentId, conversationId)) {
    events.push(event);
  }

  // Reconstruct ConverseResponse from events
  const convId = events.find((e) => e.type === "conversation_id_set")?.conversation_id || "";
  const finalMessage = events.find((e) => e.type === "message_complete")?.message || "No response";

  return {
    conversation_id: convId,
    round_id: "",
    status: "complete",
    steps: [],
    response: { message: finalMessage },
    model_usage: { input_tokens: 0, llm_calls: 0, model: "" },
  };
}

import type { AgentId, ConverseResponse } from "./types";

export async function sendMessage(
  message: string,
  agentId: AgentId = "incident-cortex-triage",
  conversationId?: string
): Promise<ConverseResponse> {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, agentId, conversationId }),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(error.detail || error.error || "Request failed");
  }

  return resp.json();
}

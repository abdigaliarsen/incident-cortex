"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, AgentId, ConverseResponse, ToolCall } from "@/lib/types";
import { sendMessage as apiSendMessage } from "@/lib/api";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [activeAgent, setActiveAgent] = useState<AgentId>("incident-cortex-triage");
  const idCounter = useRef(0);

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `msg-${idCounter.current}`;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      try {
        const data: ConverseResponse = await apiSendMessage(
          text,
          activeAgent,
          conversationId
        );

        setConversationId(data.conversation_id);

        const toolCalls: ToolCall[] = [];
        for (const step of data.steps || []) {
          // Steps with type=tool_call have tool_id at step level
          if (step.type === "tool_call" && step.tool_id) {
            toolCalls.push({
              toolId: step.tool_id,
              status: "complete",
              result: String(step.results?.[0]?.data?.esql ?? JSON.stringify(step.params)),
            });
          }
          // Also handle nested tool_calls format
          for (const tc of step.tool_calls || []) {
            toolCalls.push({
              toolId: tc.tool_id,
              status: "complete",
              result: tc.result,
            });
          }
        }

        const agentMsg: ChatMessage = {
          id: nextId(),
          role: "agent",
          agentId: activeAgent,
          content: data.response?.message || "No response",
          timestamp: new Date(),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        };
        setMessages((prev) => [...prev, agentMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: nextId(),
          role: "agent",
          agentId: activeAgent,
          content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
      }
    },
    [activeAgent, conversationId, nextId]
  );

  return {
    messages,
    loading,
    activeAgent,
    setActiveAgent,
    sendMessage,
    conversationId,
  };
}

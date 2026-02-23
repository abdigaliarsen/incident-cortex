"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ChatMessage,
  AgentId,
  ToolCall,
  StreamingStatus,
  RemediationAction,
} from "@/lib/types";
import { streamMessage } from "@/lib/api";
import { REMEDIATION_TOOL_IDS } from "@/lib/constants";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [activeAgent, setActiveAgent] =
    useState<AgentId>("incident-cortex-triage");
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>({});
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

      const placeholderId = nextId();
      const placeholder: ChatMessage = {
        id: placeholderId,
        role: "agent",
        agentId: activeAgent,
        content: "",
        timestamp: new Date(),
        toolCalls: [],
        remediationActions: [],
      };
      setMessages((prev) => [...prev, placeholder]);

      try {
        for await (const event of streamMessage(
          text,
          activeAgent,
          conversationId
        )) {
          switch (event.type) {
            case "conversation_id_set":
              if (event.conversation_id) {
                setConversationId(event.conversation_id);
              }
              break;

            case "reasoning":
              setStreamingStatus({ currentPhase: "reasoning" });
              break;

            case "tool_call":
              if (event.tool_id) {
                setStreamingStatus({
                  currentPhase: "calling",
                  currentTool: event.tool_id,
                });
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== placeholderId) return m;
                    const tc: ToolCall = {
                      toolId: event.tool_id!,
                      status: "running",
                      params: event.params,
                    };
                    const toolCalls = [...(m.toolCalls || []), tc];

                    // Check if this is a remediation tool
                    let remediationActions = m.remediationActions || [];
                    if (REMEDIATION_TOOL_IDS.has(event.tool_id!)) {
                      const action: RemediationAction = {
                        id: event.tool_call_id || event.tool_id!,
                        label:
                          event.tool_id!
                            .replace(/-/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase()),
                        toolId: event.tool_id!,
                        status: "pending",
                      };
                      remediationActions = [...remediationActions, action];
                    }

                    return { ...m, toolCalls, remediationActions };
                  })
                );
              }
              break;

            case "tool_result":
              if (event.tool_id) {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== placeholderId) return m;
                    const toolCalls = (m.toolCalls || []).map((tc) =>
                      tc.toolId === event.tool_id && tc.status === "running"
                        ? { ...tc, status: "complete" as const, result: event.result }
                        : tc
                    );
                    return { ...m, toolCalls };
                  })
                );
              }
              break;

            case "sub_agent_call":
              if (event.sub_agent_id) {
                setStreamingStatus({
                  currentPhase: "calling",
                  currentTool: `Delegating to ${event.sub_agent_id.replace("incident-cortex-", "")}`,
                });
              }
              break;

            case "message_chunk":
              if (event.chunk) {
                setStreamingStatus({ currentPhase: "streaming" });
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === placeholderId
                      ? { ...m, content: m.content + event.chunk }
                      : m
                  )
                );
              }
              break;

            case "message_complete":
              if (event.message) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === placeholderId
                      ? { ...m, content: event.message! }
                      : m
                  )
                );
              }
              break;

            case "round_complete":
              setStreamingStatus({});
              break;
          }
        }

        // Clean up empty arrays on the placeholder
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== placeholderId) return m;
            return {
              ...m,
              toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
              remediationActions: m.remediationActions?.length
                ? m.remediationActions
                : undefined,
            };
          })
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
                  toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
                  remediationActions: undefined,
                }
              : m
          )
        );
      } finally {
        setLoading(false);
        setStreamingStatus({});
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
    streamingStatus,
  };
}

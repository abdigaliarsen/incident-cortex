"use client";

import { useMemo } from "react";
import type { AgentId, AgentStatus, TimelineEvent } from "@/lib/types";
import { useChat } from "@/hooks/useChat";
import { useDetailsPanel } from "@/hooks/useDetailsPanel";
import { AgentPanel } from "@/components/panels/AgentPanel";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { DetailsPanel } from "@/components/panels/DetailsPanel";

export default function Home() {
  const { messages, loading, activeAgent, setActiveAgent, sendMessage } =
    useChat();
  const { view, showTimeline, showTool, showAgent } = useDetailsPanel();

  const agentStatuses = useMemo<Record<AgentId, AgentStatus>>(() => {
    const statuses: Record<AgentId, AgentStatus> = {
      "incident-cortex-triage": "idle",
      "incident-cortex-log-analyzer": "idle",
      "incident-cortex-metrics": "idle",
      "incident-cortex-security": "idle",
    };

    for (const msg of messages) {
      if (msg.role === "agent" && msg.agentId) {
        statuses[msg.agentId] = "complete";
      }
    }

    if (loading) {
      statuses[activeAgent] = "investigating";
    }

    return statuses;
  }, [messages, loading, activeAgent]);

  const timelineEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];
    for (const msg of messages) {
      if (msg.role === "agent" && msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          events.push({
            id: `${msg.id}-${tc.toolId}`,
            timestamp: msg.timestamp,
            label: tc.toolId,
            type: tc.toolId.includes("security") || tc.toolId.includes("ip")
              ? "security"
              : tc.toolId.includes("metric") || tc.toolId.includes("health")
              ? "metric"
              : tc.toolId.includes("deploy")
              ? "deployment"
              : "error",
            detail: tc.status,
          });
        }
      }
    }
    return events;
  }, [messages]);

  return (
    <div className="h-screen flex">
      <AgentPanel
        activeAgent={activeAgent}
        agentStatuses={agentStatuses}
        onAgentClick={showAgent}
        onAgentSelect={setActiveAgent}
      />
      <ChatPanel
        messages={messages}
        loading={loading}
        activeAgent={activeAgent}
        onSend={sendMessage}
        onToolClick={(toolId) => {
          const allToolCalls = messages.flatMap((m) => m.toolCalls || []);
          const tc = allToolCalls.find((t) => t.toolId === toolId);
          if (tc) showTool(tc);
        }}
      />
      <DetailsPanel
        view={view}
        timelineEvents={timelineEvents}
        onShowTimeline={showTimeline}
      />
    </div>
  );
}

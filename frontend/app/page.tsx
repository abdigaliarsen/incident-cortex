"use client";

import { useMemo, useState } from "react";
import type { AgentId, AgentStatus, AgentInfo, TimelineEvent } from "@/lib/types";
import { AGENTS, TOOL_LABELS } from "@/lib/constants";
import { useChat } from "@/hooks/useChat";
import { useDetailsPanel } from "@/hooks/useDetailsPanel";
import { AgentPanel } from "@/components/panels/AgentPanel";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { DetailsPanel } from "@/components/panels/DetailsPanel";

export default function Home() {
  const { messages, loading, activeAgent, setActiveAgent, sendMessage, streamingStatus } =
    useChat();
  const { view, showTimeline, showTool, showAgent, showA2A } = useDetailsPanel();
  const [mobilePanel, setMobilePanel] = useState<"chat" | "agents" | "details">("chat");

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
            label: TOOL_LABELS[tc.toolId] ?? tc.toolId,
            type: tc.toolId.includes("notify") || tc.toolId.includes("jira") || tc.toolId.includes("rollback") || tc.toolId.includes("block-ip") || tc.toolId.includes("incident-report")
              ? "remediation"
              : tc.toolId.includes("security") || tc.toolId.includes("ip") || tc.toolId.includes("threat")
              ? "security"
              : tc.toolId.includes("metric") || tc.toolId.includes("health") || tc.toolId.includes("join")
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

  const handleAgentClick = (agent: AgentInfo) => {
    setActiveAgent(agent.id);
    showAgent(agent);
    setMobilePanel("chat");
  };

  const handleToolClick = (toolId: string) => {
    const allToolCalls = messages.flatMap((m) => m.toolCalls || []);
    const tc = allToolCalls.find((t) => t.toolId === toolId);
    if (tc) {
      showTool(tc);
      setMobilePanel("details");
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row">
      {/* Mobile navigation bar */}
      <div className="md:hidden flex border-b border-[#343741] bg-[#25262E]">
        {(["agents", "chat", "details"] as const).map((panel) => (
          <button
            key={panel}
            onClick={() => setMobilePanel(panel)}
            className={`flex-1 py-3 text-xs font-medium uppercase tracking-wide transition-colors ${
              mobilePanel === panel
                ? "text-[#0077CC] border-b-2 border-[#0077CC]"
                : "text-[#69707D]"
            }`}
          >
            {panel === "agents" ? `${AGENTS[activeAgent].shortName}` : panel === "chat" ? "Chat" : "Details"}
          </button>
        ))}
      </div>

      {/* Desktop: always visible. Mobile: controlled by mobilePanel */}
      <div className={`${mobilePanel === "agents" ? "flex" : "hidden"} md:flex flex-col`}>
        <AgentPanel
          activeAgent={activeAgent}
          agentStatuses={agentStatuses}
          onAgentClick={handleAgentClick}
          onA2AClick={() => {
            showA2A(activeAgent);
            setMobilePanel("details");
          }}
        />
      </div>
      <div className={`${mobilePanel === "chat" ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
        <ChatPanel
          messages={messages}
          loading={loading}
          activeAgent={activeAgent}
          streamingStatus={streamingStatus}
          onSend={sendMessage}
          onToolClick={handleToolClick}
        />
      </div>
      <div className={`${mobilePanel === "details" ? "flex" : "hidden"} md:flex flex-col`}>
        <DetailsPanel
          view={view}
          timelineEvents={timelineEvents}
          onShowTimeline={showTimeline}
        />
      </div>
    </div>
  );
}

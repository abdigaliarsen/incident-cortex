"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, AgentId, StreamingStatus } from "@/lib/types";
import { AGENTS } from "@/lib/constants";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

const AGENT_EMPTY_STATES: Record<AgentId, { emoji: string; title: string; description: string; suggestions: string[] }> = {
  "incident-cortex-triage": {
    emoji: "🔍",
    title: "Ready to investigate",
    description: "Describe an incident, paste an alert, or ask about service health. The Triage agent will coordinate the investigation across logs, metrics, and security signals.",
    suggestions: [
      "Investigate payment-service 500 errors",
      "Check service health for the last hour",
      "Are there any security threats?",
    ],
  },
  "incident-cortex-log-analyzer": {
    emoji: "📋",
    title: "Log analysis ready",
    description: "Ask about error patterns, trace correlations, or first occurrences. The Log Analyzer will dig through application and system logs.",
    suggestions: [
      "Find the error spike in payment-service",
      "Trace the root cause of timeout errors",
      "When did this error first appear?",
    ],
  },
  "incident-cortex-metrics": {
    emoji: "📊",
    title: "Metrics analysis ready",
    description: "Ask about CPU/memory anomalies, latency spikes, or deployment correlations. The Metrics Analyzer watches infrastructure health.",
    suggestions: [
      "Detect metric anomalies in the last hour",
      "Correlate recent deploys with latency spikes",
      "Show CPU and memory trends for api-gateway",
    ],
  },
  "incident-cortex-security": {
    emoji: "🛡️",
    title: "Security analysis ready",
    description: "Ask about brute-force attempts, suspicious IPs, or threat intelligence. The Security Analyst monitors for active threats.",
    suggestions: [
      "Check for brute-force login attempts",
      "Investigate suspicious IP addresses",
      "Are there any active security alerts?",
    ],
  },
};

interface ChatPanelProps {
  messages: ChatMessageType[];
  loading: boolean;
  activeAgent: AgentId;
  streamingStatus?: StreamingStatus;
  onSend: (message: string) => void;
  onToolClick?: (toolId: string) => void;
}

export function ChatPanel({
  messages,
  loading,
  activeAgent,
  streamingStatus,
  onSend,
  onToolClick,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const agentInfo = AGENTS[activeAgent];
  const emptyState = AGENT_EMPTY_STATES[activeAgent];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div data-testid="chat-panel" className="flex-1 flex flex-col bg-[#1D1E24]">
      <div className="p-4 border-b border-[#343741]">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0"
            style={{ backgroundColor: agentInfo.color }}
          >
            {agentInfo.symbol}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#DFE5EF]">
              {agentInfo.name}
            </h1>
            <p className="text-xs text-[#69707D]">
              {agentInfo.description}
            </p>
          </div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center space-y-3 max-w-md">
              <div className="text-4xl">{emptyState.emoji}</div>
              <h2 className="text-lg font-medium text-[#DFE5EF]">
                {emptyState.title}
              </h2>
              <p className="text-sm text-[#69707D]">
                {emptyState.description}
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {emptyState.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onSend(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#2C2D35] text-[#98A2B3] hover:bg-[#343741] hover:text-[#DFE5EF] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((msg) => {
          // Hide empty placeholder messages (agent is still thinking)
          if (msg.role === "agent" && !msg.content && !msg.toolCalls?.length) return null;
          return <ChatMessage key={msg.id} message={msg} onToolClick={onToolClick} />;
        })}
        {loading && <TypingIndicator agentId={activeAgent} streamingStatus={streamingStatus} />}
      </div>
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}

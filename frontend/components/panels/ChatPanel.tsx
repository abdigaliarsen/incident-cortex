"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage as ChatMessageType, AgentId, StreamingStatus } from "@/lib/types";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  return (
    <div data-testid="chat-panel" className="flex-1 flex flex-col bg-[#1D1E24]">
      <div className="p-4 border-b border-[#343741]">
        <h1 className="text-lg font-semibold text-[#DFE5EF]">
          Incident Cortex
        </h1>
        <p className="text-xs text-[#69707D]">
          Multi-agent SRE &amp; Security Command Center
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center space-y-3 max-w-md">
              <div className="text-4xl">🔍</div>
              <h2 className="text-lg font-medium text-[#DFE5EF]">
                Ready to investigate
              </h2>
              <p className="text-sm text-[#69707D]">
                Describe an incident, paste an alert, or ask about service health.
                The Triage agent will coordinate the investigation across logs,
                metrics, and security signals.
              </p>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {[
                  "Investigate payment-service 500 errors",
                  "Check service health for the last hour",
                  "Are there any security threats?",
                ].map((suggestion) => (
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
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} onToolClick={onToolClick} />
        ))}
        {loading && <TypingIndicator agentId={activeAgent} streamingStatus={streamingStatus} />}
      </div>
      <ChatInput onSend={onSend} disabled={loading} />
    </div>
  );
}

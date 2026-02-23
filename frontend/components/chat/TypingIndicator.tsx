import type { AgentId, StreamingStatus } from "@/lib/types";
import { AGENTS, TOOL_LABELS } from "@/lib/constants";

interface TypingIndicatorProps {
  agentId: AgentId;
  streamingStatus?: StreamingStatus;
}

export function TypingIndicator({ agentId, streamingStatus }: TypingIndicatorProps) {
  const agent = AGENTS[agentId];

  let statusText = `${agent.shortName} is investigating`;
  if (streamingStatus?.currentPhase === "reasoning") {
    statusText = "Reasoning...";
  } else if (
    streamingStatus?.currentPhase === "calling" &&
    streamingStatus.currentTool
  ) {
    const label =
      TOOL_LABELS[streamingStatus.currentTool] ?? streamingStatus.currentTool;
    statusText = `Calling ${label}...`;
  } else if (streamingStatus?.currentPhase === "streaming") {
    statusText = "Writing response...";
  }

  return (
    <div data-testid="typing-indicator" className="flex items-center gap-3 px-4 py-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
        style={{ backgroundColor: agent.color }}
      >
        {agent.symbol}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[#98A2B3]">{statusText}</span>
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#98A2B3] animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

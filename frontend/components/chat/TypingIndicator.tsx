import type { AgentId } from "@/lib/types";
import { AGENTS } from "@/lib/constants";

interface TypingIndicatorProps {
  agentId: AgentId;
}

export function TypingIndicator({ agentId }: TypingIndicatorProps) {
  const agent = AGENTS[agentId];

  return (
    <div data-testid="typing-indicator" className="flex items-center gap-3 px-4 py-2">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
        style={{ backgroundColor: agent.color }}
      >
        {agent.symbol}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-[#98A2B3]">{agent.shortName} is investigating</span>
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

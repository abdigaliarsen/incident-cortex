import type { AgentId } from "@/lib/types";
import { AGENTS } from "@/lib/constants";

interface AgentBadgeProps {
  agentId: AgentId;
  size?: "sm" | "md";
}

export function AgentBadge({ agentId, size = "md" }: AgentBadgeProps) {
  const agent = AGENTS[agentId];
  const sizeClasses = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeClasses} rounded-full flex items-center justify-center font-bold text-black`}
        style={{ backgroundColor: agent.color }}
      >
        {agent.symbol}
      </div>
      {size === "md" && (
        <span className="text-sm font-medium text-[#DFE5EF]">
          {agent.shortName}
        </span>
      )}
    </div>
  );
}

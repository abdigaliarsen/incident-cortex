import type { AgentInfo } from "@/lib/types";

interface AgentDetailProps {
  agent: AgentInfo;
}

export function AgentDetail({ agent }: AgentDetailProps) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-black"
          style={{ backgroundColor: agent.color }}
        >
          {agent.symbol}
        </div>
        <div>
          <h3 className="text-sm font-medium text-[#DFE5EF]">{agent.name}</h3>
          <p className="text-xs text-[#69707D]">{agent.id}</p>
        </div>
      </div>
      <p className="text-sm text-[#98A2B3]">{agent.description}</p>
    </div>
  );
}

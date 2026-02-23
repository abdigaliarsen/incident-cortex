import type { AgentId, AgentStatus, AgentInfo } from "@/lib/types";
import { AGENTS } from "@/lib/constants";
import { StatusIndicator } from "@/components/shared/StatusIndicator";

interface AgentPanelProps {
  activeAgent: AgentId;
  agentStatuses: Record<AgentId, AgentStatus>;
  onAgentClick: (agent: AgentInfo) => void;
  onA2AClick?: () => void;
}

export function AgentPanel({
  activeAgent,
  agentStatuses,
  onAgentClick,
  onA2AClick,
}: AgentPanelProps) {
  return (
    <div
      data-testid="agent-panel"
      className="w-full md:w-60 bg-[#25262E] border-r border-[#343741] flex flex-col"
    >
      <div className="p-4 border-b border-[#343741]">
        <h2 className="text-sm font-semibold text-[#DFE5EF] tracking-wide uppercase">
          Agents
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {(Object.values(AGENTS) as AgentInfo[]).map((agent) => {
          const isActive = agent.id === activeAgent;
          const status = agentStatuses[agent.id] || "idle";
          return (
            <button
              key={agent.id}
              onClick={() => {
                onAgentClick(agent);
              }}
              className={`w-full text-left rounded-lg p-3 transition-colors ${
                isActive
                  ? "bg-[#2C2D35] ring-1 ring-[#0077CC]"
                  : "hover:bg-[#2C2D35]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.symbol}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[#DFE5EF] truncate">
                      {agent.shortName}
                    </span>
                    <StatusIndicator status={status} />
                  </div>
                  <p className="text-[10px] text-[#69707D] truncate">
                    {agent.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="p-3 border-t border-[#343741] space-y-2">
        <div className="text-[10px] text-[#69707D]">
          <p>Elastic Agent Builder</p>
          <p>17 tools &middot; 5 workflows</p>
        </div>
        <button
          onClick={onA2AClick}
          className="w-full text-left text-[10px] px-2 py-1.5 rounded bg-[#1D1E24] hover:bg-[#343741] transition-colors flex items-center gap-2"
        >
          <span className="text-[#4ECDC4]">A2A</span>
          <span className="text-[#45B7D1]">MCP</span>
          <span className="text-[#F7DC6F]">API</span>
          <span className="text-[#69707D] ml-auto">View &rarr;</span>
        </button>
      </div>
    </div>
  );
}

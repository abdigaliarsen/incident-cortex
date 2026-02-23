import type { AgentId } from "@/lib/types";
import { AGENTS } from "@/lib/constants";

interface A2ACardProps {
  agentId: AgentId;
}

export function A2ACard({ agentId }: A2ACardProps) {
  const agent = AGENTS[agentId];

  const agentCard = {
    name: agent.name,
    description: agent.description,
    url: `{KIBANA_URL}/api/agent_builder/a2a/${agentId}`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: [
      {
        id: "incident-investigation",
        name: "Incident Investigation",
        description: `Investigate incidents using ES|QL tools across logs, metrics, and security data`,
      },
    ],
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
          style={{ backgroundColor: agent.color }}
        >
          {agent.symbol}
        </div>
        <div>
          <h3 className="text-sm font-medium text-[#DFE5EF]">A2A Protocol</h3>
          <p className="text-[10px] text-[#69707D]">Agent-to-Agent Interoperability</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-[#69707D] uppercase tracking-wide mb-1">Agent Card Endpoint</p>
          <code className="block text-xs bg-[#1D1E24] rounded p-2 text-[#4ECDC4] break-all">
            GET /api/agent_builder/a2a/{agentId}.json
          </code>
        </div>

        <div>
          <p className="text-[10px] text-[#69707D] uppercase tracking-wide mb-1">A2A Protocol Endpoint</p>
          <code className="block text-xs bg-[#1D1E24] rounded p-2 text-[#4ECDC4] break-all">
            POST /api/agent_builder/a2a/{agentId}
          </code>
        </div>

        <div>
          <p className="text-[10px] text-[#69707D] uppercase tracking-wide mb-1">Agent Card (JSON)</p>
          <pre className="text-[10px] bg-[#1D1E24] rounded p-2 text-[#DFE5EF] overflow-x-auto leading-relaxed">
            {JSON.stringify(agentCard, null, 2)}
          </pre>
        </div>

        <div>
          <p className="text-[10px] text-[#69707D] uppercase tracking-wide mb-1">MCP Server</p>
          <code className="block text-xs bg-[#1D1E24] rounded p-2 text-[#45B7D1] break-all">
            npx @anthropic/mcp-server-elastic
          </code>
          <p className="text-[10px] text-[#69707D] mt-1">
            Exposes all Agent Builder tools to Claude Desktop and other MCP clients.
          </p>
        </div>

        <div className="border-t border-[#343741] pt-3">
          <p className="text-[10px] text-[#69707D] uppercase tracking-wide mb-2">Supported Protocols</p>
          <div className="flex gap-2">
            <span className="text-[10px] px-2 py-1 rounded bg-[#0077CC]/20 text-[#45B7D1]">A2A</span>
            <span className="text-[10px] px-2 py-1 rounded bg-[#4ECDC4]/20 text-[#4ECDC4]">MCP</span>
            <span className="text-[10px] px-2 py-1 rounded bg-[#F7DC6F]/20 text-[#F7DC6F]">REST API</span>
          </div>
        </div>
      </div>
    </div>
  );
}

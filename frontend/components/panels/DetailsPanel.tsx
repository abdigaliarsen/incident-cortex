import type { DetailView, TimelineEvent } from "@/lib/types";
import { IncidentTimeline } from "@/components/details/IncidentTimeline";
import { ToolCallView } from "@/components/details/ToolCallView";
import { AgentDetail } from "@/components/details/AgentDetail";

interface DetailsPanelProps {
  view: DetailView;
  timelineEvents: TimelineEvent[];
  onShowTimeline: () => void;
}

export function DetailsPanel({
  view,
  timelineEvents,
  onShowTimeline,
}: DetailsPanelProps) {
  return (
    <div
      data-testid="details-panel"
      className="w-80 bg-[#25262E] border-l border-[#343741] flex flex-col"
    >
      <div className="p-4 border-b border-[#343741]">
        <h2 className="text-sm font-semibold text-[#DFE5EF] tracking-wide uppercase">
          Details
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {view.type === "timeline" && (
          <IncidentTimeline events={timelineEvents} />
        )}
        {view.type === "tool" && (
          <ToolCallView toolCall={view.toolCall} onBack={onShowTimeline} />
        )}
        {view.type === "agent" && <AgentDetail agent={view.agent} />}
      </div>
    </div>
  );
}

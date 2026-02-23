import type { TimelineEvent } from "@/lib/types";

const TYPE_COLORS: Record<TimelineEvent["type"], string> = {
  error: "#FF6666",
  metric: "#45B7D1",
  security: "#F7DC6F",
  deployment: "#B298DC",
  remediation: "#00BFB3",
};

interface IncidentTimelineProps {
  events: TimelineEvent[];
}

export function IncidentTimeline({ events }: IncidentTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="p-4 text-center text-[#69707D] text-sm">
        No timeline events yet. Start an investigation to see events appear here.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-[#DFE5EF] mb-3">
        Incident Timeline
      </h3>
      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#343741]" />
        {events.map((event) => (
          <div key={event.id} className="relative flex gap-3 pb-3">
            <div
              className="relative z-10 w-[15px] h-[15px] rounded-full flex-shrink-0 mt-0.5"
              style={{ backgroundColor: TYPE_COLORS[event.type] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#DFE5EF]">{event.label}</p>
              {event.detail && (
                <p className="text-xs text-[#69707D] mt-0.5">{event.detail}</p>
              )}
              <p className="text-[10px] text-[#69707D] mt-0.5">
                {event.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

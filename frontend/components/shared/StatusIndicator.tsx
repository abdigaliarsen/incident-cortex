import type { AgentStatus } from "@/lib/types";

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#69707D",
  active: "#00BFB3",
  investigating: "#FEC514",
  complete: "#00BFB3",
  error: "#FF6666",
};

interface StatusIndicatorProps {
  status: AgentStatus;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const color = STATUS_COLORS[status];
  const isActive = status === "active" || status === "investigating";

  return (
    <span className="relative flex h-2.5 w-2.5">
      {isActive && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
          style={{ backgroundColor: color }}
        />
      )}
      <span
        className="relative inline-flex h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}

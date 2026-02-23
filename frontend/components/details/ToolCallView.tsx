import type { ToolCall } from "@/lib/types";
import { TOOL_LABELS } from "@/lib/constants";

interface ToolCallViewProps {
  toolCall: ToolCall;
  onBack: () => void;
}

function tryPrettyJSON(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function ToolCallView({ toolCall, onBack }: ToolCallViewProps) {
  const humanLabel = TOOL_LABELS[toolCall.toolId];

  return (
    <div className="p-4 space-y-3">
      <button
        onClick={onBack}
        className="text-xs text-[#0077CC] hover:underline"
      >
        &larr; Back to timeline
      </button>
      {humanLabel && (
        <h3 className="text-sm font-medium text-[#DFE5EF]">{humanLabel}</h3>
      )}
      <p className="text-xs font-mono text-[#69707D]">{toolCall.toolId}</p>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            toolCall.status === "complete"
              ? "bg-[#00BFB3]/20 text-[#00BFB3]"
              : toolCall.status === "error"
              ? "bg-[#FF6666]/20 text-[#FF6666]"
              : "bg-[#FEC514]/20 text-[#FEC514]"
          }`}
        >
          {toolCall.status}
        </span>
      </div>
      {toolCall.params && Object.keys(toolCall.params).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-[#98A2B3] font-semibold">Parameters</p>
          <div className="bg-[#1D1E24] rounded p-3 space-y-1">
            {Object.entries(toolCall.params).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-[#98A2B3] font-mono shrink-0">{key}:</span>
                <span className="text-[#DFE5EF] font-mono break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {toolCall.result && (
        <div className="space-y-1">
          <p className="text-xs text-[#98A2B3] font-semibold">Result</p>
          <pre className="bg-[#1D1E24] rounded p-3 text-xs text-[#DFE5EF] overflow-x-auto whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
            {tryPrettyJSON(toolCall.result)}
          </pre>
        </div>
      )}
    </div>
  );
}

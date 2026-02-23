import type { ToolCall } from "@/lib/types";

interface ToolCallViewProps {
  toolCall: ToolCall;
  onBack: () => void;
}

export function ToolCallView({ toolCall, onBack }: ToolCallViewProps) {
  return (
    <div className="p-4 space-y-3">
      <button
        onClick={onBack}
        className="text-xs text-[#0077CC] hover:underline"
      >
        &larr; Back to timeline
      </button>
      <h3 className="text-sm font-medium text-[#DFE5EF]">
        {toolCall.toolId}
      </h3>
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
      {toolCall.result && (
        <pre className="bg-[#1D1E24] rounded p-3 text-xs text-[#DFE5EF] overflow-x-auto whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
          {toolCall.result}
        </pre>
      )}
    </div>
  );
}

import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { AgentBadge } from "@/components/shared/AgentBadge";

interface ChatMessageProps {
  message: ChatMessageType;
  onToolClick?: (toolId: string) => void;
}

export function ChatMessage({ message, onToolClick }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && message.agentId && (
        <div className="flex-shrink-0 mt-1">
          <AgentBadge agentId={message.agentId} size="sm" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-[#0077CC] text-white"
            : "bg-[#2C2D35] text-[#DFE5EF]"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
          {message.content}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 border-t border-[#343741] pt-2">
            <p className="text-xs text-[#98A2B3] mb-1">Tools used:</p>
            <div className="flex flex-wrap gap-1">
              {message.toolCalls.map((tc, i) => (
                <button
                  key={i}
                  onClick={() => onToolClick?.(tc.toolId)}
                  className="text-xs px-2 py-0.5 rounded bg-[#343741] text-[#45B7D1] hover:bg-[#3d3e47] transition-colors cursor-pointer"
                >
                  {tc.toolId}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="text-[10px] text-[#69707D] mt-1">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

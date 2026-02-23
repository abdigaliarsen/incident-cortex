import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { AgentBadge } from "@/components/shared/AgentBadge";
import { TOOL_LABELS } from "@/lib/constants";
import { RemediationCard } from "./RemediationCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-[#DFE5EF] mb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-[#DFE5EF] mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-[#DFE5EF] mb-1">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-2 text-[#DFE5EF]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-2 text-[#DFE5EF]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-2 text-[#DFE5EF]">{children}</ol>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="block bg-[#1D1E24] rounded p-3 overflow-x-auto text-[#45B7D1] font-mono text-xs my-2">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-[#1D1E24] rounded px-1 text-[#45B7D1] font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-[#1D1E24] rounded p-3 overflow-x-auto my-2">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#0077CC] pl-3 text-[#98A2B3] italic my-2">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[#343741] px-2 py-1 text-left text-[#98A2B3] bg-[#1D1E24]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[#343741] px-2 py-1 text-[#DFE5EF]">
      {children}
    </td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#DFE5EF]">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-[#0077CC] hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

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
        {isUser ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
            {message.content}
          </div>
        ) : (
          <div className="text-sm leading-relaxed break-words prose-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-3 border-t border-[#343741] pt-2">
            <p className="text-xs text-[#98A2B3] mb-1">Tools used:</p>
            <div className="flex flex-wrap gap-1">
              {message.toolCalls.map((tc, i) => (
                <button
                  key={i}
                  data-tool-id={tc.toolId}
                  onClick={() => onToolClick?.(tc.toolId)}
                  className="text-xs px-2 py-0.5 rounded bg-[#343741] text-[#45B7D1] hover:bg-[#3d3e47] transition-colors cursor-pointer"
                >
                  {TOOL_LABELS[tc.toolId] ?? tc.toolId}
                </button>
              ))}
            </div>
          </div>
        )}
        {message.remediationActions && message.remediationActions.length > 0 && (
          <RemediationCard actions={message.remediationActions} />
        )}
        <div className="text-[10px] text-[#69707D] mt-1">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

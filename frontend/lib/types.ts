export type AgentId =
  | "incident-cortex-triage"
  | "incident-cortex-log-analyzer"
  | "incident-cortex-metrics"
  | "incident-cortex-security";

export type AgentStatus = "idle" | "active" | "investigating" | "complete" | "error";

export type WorkflowStatus = "pending" | "running" | "complete" | "failed";

export interface AgentInfo {
  id: AgentId;
  name: string;
  shortName: string;
  symbol: string;
  color: string;
  description: string;
}

export interface RemediationAction {
  id: string;
  label: string;
  toolId: string;
  status: "pending" | "approved" | "rejected";
}

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agentId?: AgentId;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  remediationActions?: RemediationAction[];
}

export interface ToolCall {
  toolId: string;
  status: "running" | "complete" | "error";
  result?: string;
  params?: Record<string, string>;
}

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  label: string;
  type: "error" | "metric" | "security" | "deployment" | "remediation";
  detail?: string;
}

export type DetailView =
  | { type: "timeline" }
  | { type: "tool"; toolCall: ToolCall }
  | { type: "agent"; agent: AgentInfo };

export interface ConverseResponse {
  conversation_id: string;
  round_id: string;
  status: string;
  steps: ConverseStep[];
  response: {
    message: string;
  };
  model_usage: {
    input_tokens: number;
    llm_calls: number;
    model: string;
  };
}

export type SSEEventType =
  | "conversation_id_set"
  | "reasoning"
  | "tool_call"
  | "tool_progress"
  | "tool_result"
  | "thinking_complete"
  | "message_chunk"
  | "message_complete"
  | "round_complete";

export interface SSEEvent {
  type: SSEEventType;
  conversation_id?: string;
  reasoning?: string;
  tool_id?: string;
  tool_call_id?: string;
  params?: Record<string, string>;
  result?: string;
  chunk?: string;
  message?: string;
}

export interface StreamingStatus {
  currentTool?: string;
  currentPhase?: "reasoning" | "calling" | "streaming";
}

export interface ConverseStep {
  type: string;
  // type=tool_call steps have these at step level
  tool_id?: string;
  params?: Record<string, string>;
  tool_call_id?: string;
  results?: { type: string; data: Record<string, unknown> }[];
  reasoning?: string;
  // Fallback nested format
  tool_calls?: {
    tool_id: string;
    tool_params: Record<string, string>;
    result?: string;
  }[];
}

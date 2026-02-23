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

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  agentId?: AgentId;
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  toolId: string;
  status: "running" | "complete" | "error";
  result?: string;
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

export interface ConverseStep {
  type: string;
  tool_calls?: {
    tool_id: string;
    tool_params: Record<string, string>;
    result?: string;
  }[];
}

"use client";

import { useState, useCallback } from "react";
import type { DetailView, ToolCall, AgentInfo } from "@/lib/types";

export function useDetailsPanel() {
  const [view, setView] = useState<DetailView>({ type: "timeline" });

  const showTimeline = useCallback(() => setView({ type: "timeline" }), []);
  const showTool = useCallback(
    (toolCall: ToolCall) => setView({ type: "tool", toolCall }),
    []
  );
  const showAgent = useCallback(
    (agent: AgentInfo) => setView({ type: "agent", agent }),
    []
  );

  return { view, showTimeline, showTool, showAgent };
}

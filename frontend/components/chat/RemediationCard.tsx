"use client";

import { useState } from "react";
import type { RemediationAction, RemediationResult } from "@/lib/types";
import { TOOL_LABELS } from "@/lib/constants";

interface RemediationCardProps {
  actions: RemediationAction[];
}

export function RemediationCard({ actions }: RemediationCardProps) {
  const [decision, setDecision] = useState<
    "pending" | "executing" | "approved" | "rejected"
  >("pending");
  const [results, setResults] = useState<RemediationResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(actions.map((a) => a.id))
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const execute = async (mode: "approved" | "rejected") => {
    setDecision("executing");
    try {
      const approvedActions =
        mode === "approved"
          ? actions.filter((a) => selected.has(a.id))
          : [];
      const res = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: approvedActions, decision: mode }),
      });
      const data = (await res.json()) as { results: RemediationResult[] };
      setResults(data.results ?? []);
    } catch {
      // If the call fails, still transition so the UI isn't stuck
    }
    setDecision(mode);
  };

  const borderColor =
    decision === "approved"
      ? "border-[#00BFB3]"
      : decision === "rejected"
        ? "border-[#FF6666]"
        : decision === "executing"
          ? "border-[#45B7D1]"
          : "border-[#FEC514]";

  return (
    <div
      className={`mt-3 rounded-lg border ${borderColor} bg-[#1D1E24] p-4 space-y-3`}
    >
      {decision === "pending" && (
        <>
          <h4 className="text-sm font-semibold text-[#FEC514]">
            Proposed Remediation Actions
          </h4>
          <div className="space-y-2">
            {actions.map((action) => (
              <label
                key={action.id}
                className="flex items-center gap-2 text-sm text-[#DFE5EF] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(action.id)}
                  onChange={() => toggle(action.id)}
                  className="accent-[#00BFB3] w-4 h-4"
                />
                <span>{TOOL_LABELS[action.toolId] ?? action.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => execute("approved")}
              disabled={selected.size === 0}
              className="px-3 py-1.5 rounded text-xs font-medium bg-[#00BFB3] text-black hover:bg-[#00D9CA] transition-colors disabled:opacity-50"
            >
              Approve {selected.size === actions.length ? "All" : `(${selected.size})`}
            </button>
            <button
              onClick={() => execute("rejected")}
              className="px-3 py-1.5 rounded text-xs font-medium bg-[#343741] text-[#98A2B3] hover:bg-[#3d3e47] transition-colors"
            >
              Override
            </button>
          </div>
        </>
      )}
      {decision === "executing" && (
        <div className="flex items-center gap-2 text-sm text-[#45B7D1] font-medium">
          <div className="w-4 h-4 border-2 border-[#45B7D1] border-t-transparent rounded-full animate-spin" />
          Executing remediation&hellip;
        </div>
      )}
      {decision === "approved" && (
        <div className="space-y-1">
          <p className="text-sm text-[#00BFB3] font-medium">
            Remediation approved &mdash; {results.length} action
            {results.length !== 1 ? "s" : ""} executed
          </p>
          {results.map((r) => (
            <div
              key={r.actionId}
              className="flex items-center gap-2 text-xs text-[#DFE5EF] font-mono"
            >
              <span className={r.success ? "text-[#00BFB3]" : "text-[#FF6666]"}>
                {r.success ? "\u2713" : "\u2717"}
              </span>
              <span>{TOOL_LABELS[r.toolId] ?? r.toolId}</span>
              {r.docId && (
                <span className="text-[#98A2B3]">{r.docId}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {decision === "rejected" && (
        <p className="text-sm text-[#FF6666] font-medium">
          Remediation overridden &mdash; no actions taken
        </p>
      )}
    </div>
  );
}

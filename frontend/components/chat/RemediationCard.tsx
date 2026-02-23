"use client";

import { useState } from "react";
import type { RemediationAction } from "@/lib/types";
import { TOOL_LABELS } from "@/lib/constants";

interface RemediationCardProps {
  actions: RemediationAction[];
}

export function RemediationCard({ actions }: RemediationCardProps) {
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected">(
    "pending"
  );
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

  const borderColor =
    decision === "approved"
      ? "border-[#00BFB3]"
      : decision === "rejected"
      ? "border-[#FF6666]"
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
              onClick={() => setDecision("approved")}
              disabled={selected.size === 0}
              className="px-3 py-1.5 rounded text-xs font-medium bg-[#00BFB3] text-black hover:bg-[#00D9CA] transition-colors disabled:opacity-50"
            >
              Approve {selected.size === actions.length ? "All" : `(${selected.size})`}
            </button>
            <button
              onClick={() => setDecision("rejected")}
              className="px-3 py-1.5 rounded text-xs font-medium bg-[#343741] text-[#98A2B3] hover:bg-[#3d3e47] transition-colors"
            >
              Override
            </button>
          </div>
        </>
      )}
      {decision === "approved" && (
        <p className="text-sm text-[#00BFB3] font-medium">
          Remediation approved &mdash; workflows executing
        </p>
      )}
      {decision === "rejected" && (
        <p className="text-sm text-[#FF6666] font-medium">
          Remediation overridden &mdash; no actions taken
        </p>
      )}
    </div>
  );
}

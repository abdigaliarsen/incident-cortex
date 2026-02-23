"use client";

import { useState, useCallback, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }, [text, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex gap-2 p-4 border-t border-[#343741]">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the incident or ask a question..."
        disabled={disabled}
        rows={1}
        className="flex-1 bg-[#343741] text-[#DFE5EF] rounded-lg px-4 py-2.5 text-sm resize-none placeholder:text-[#69707D] focus:outline-none focus:ring-1 focus:ring-[#0077CC] disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="px-4 py-2.5 bg-[#0077CC] text-white rounded-lg text-sm font-medium hover:bg-[#005fa3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Send
      </button>
    </div>
  );
}

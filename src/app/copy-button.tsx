"use client";

import { useState } from "react";

export function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: textarea
      const ta = document.createElement("textarea");
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        alert("Kopieren fehlgeschlagen");
      }
      document.body.removeChild(ta);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Prompt in die Zwischenablage kopieren"
      className="text-sm text-gray-600 hover:text-blue-600 transition-colors"
    >
      {copied ? "✓ Kopiert" : "📋 Kopieren"}
    </button>
  );
}

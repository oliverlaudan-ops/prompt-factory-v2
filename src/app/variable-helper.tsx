"use client";

import { useState, useRef } from "react";
import { extractVariables } from "@/lib/prompt-variables";

/**
 * Helper component for prompt-edit forms. Shows currently detected variables
 * as chips and provides a button to insert a new {{VARIABLE}} at the cursor
 * position of the content textarea.
 */
export function VariableHelper({
  content,
  onContentChange,
  textareaRef,
  textareaId = "prompt-content",
}: {
  content: string;
  onContentChange: (next: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  textareaId?: string;
}) {
  const variables = extractVariables(content);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? internalRef;

  function tryInsert() {
    const name = newName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!name) {
      setError("Bitte einen Variablen-Namen eingeben.");
      return;
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      setError("Name muss mit Buchstabe beginnen, nur A-Z, 0-9 und _.");
      return;
    }
    const placeholder = `{{${name}}}`;
    // Try to insert at the textarea cursor; fall back to appending.
    const ta = ref.current ?? (document.getElementById(textareaId) as HTMLTextAreaElement | null);
    if (ta && typeof ta.selectionStart === "number") {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = content.slice(0, start) + placeholder + content.slice(end);
      onContentChange(next);
      // Restore cursor after the inserted placeholder
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + placeholder.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      onContentChange(content + (content.endsWith("\n") ? "" : "\n") + placeholder);
    }
    setNewName("");
    setError(null);
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Detected variables */}
      {variables.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Erkannte Variablen:
          </span>
          {variables.map((v) => (
            <span
              key={v}
              className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded font-mono"
            >
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Tipp: Verwende <code className="font-mono">{"{{VARIABLE_NAME}}"}</code> im Inhalt, um Variablen zu erzeugen.
        </p>
      )}

      {/* Insert helper */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              tryInsert();
            }
          }}
          placeholder="Variablen-Name (z. B. TONFALL)"
          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
        />
        <button
          type="button"
          onClick={tryInsert}
          className="text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-1 rounded"
        >
          + Einfügen
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

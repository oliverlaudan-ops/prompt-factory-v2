"use client";

import { useState } from "react";
import Link from "next/link";

type RefineButtonProps = {
  promptId: string;
  onApplied: (newContent: string) => void;
};

type RefineResponse = {
  ok: boolean;
  original?: string;
  refined?: string;
  model?: string;
  error?: string;
};

export function RefineButton({ promptId, onApplied }: RefineButtonProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runRefine() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/prompts/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId, instruction: instruction.trim() || undefined }),
      });
      const data: RefineResponse = await res.json();
      if (!res.ok) {
        // Special case: no key configured → link to settings
        if (data.error?.includes("Kein Ollama API-Key")) {
          setError("Kein API-Key konfiguriert — bitte erst in den Einstellungen hinterlegen.");
        } else {
          setError(data.error || "Verfeinerung fehlgeschlagen");
        }
        return;
      }
      setResult(data);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (result?.refined) {
      onApplied(result.refined);
      close();
    }
  }

  function close() {
    setOpen(false);
    setInstruction("");
    setResult(null);
    setError(null);
  }

  // Simple line-by-line diff for visual feedback
  function renderDiff(original: string, refined: string) {
    const a = original.split("\n");
    const b = refined.split("\n");
    const removed = a.filter((l) => !b.includes(l));
    const added = b.filter((l) => !a.includes(l));
    const unchanged = b.filter((l) => a.includes(l));
    return (
      <div className="text-xs font-mono space-y-1">
        {removed.length > 0 && (
          <details>
            <summary className="text-red-600 dark:text-red-400 cursor-pointer">
              {removed.length} Zeile(n) entfernt
            </summary>
            <div className="pl-4 mt-1 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 rounded p-2 whitespace-pre-wrap">
              {removed.join("\n")}
            </div>
          </details>
        )}
        {added.length > 0 && (
          <details>
            <summary className="text-green-600 dark:text-green-400 cursor-pointer">
              {added.length} Zeile(n) hinzugefügt
            </summary>
            <div className="pl-4 mt-1 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 rounded p-2 whitespace-pre-wrap">
              {added.join("\n")}
            </div>
          </details>
        )}
        <details>
          <summary className="text-gray-500 dark:text-gray-400 cursor-pointer">
            {unchanged.length} Zeile(n) unverändert
          </summary>
        </details>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition flex items-center gap-1.5"
        title="Mit KI verbessern"
      >
        ✨ Mit KI verbessern
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={close}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  ✨ Prompt mit KI verfeinern
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>

              {!result && !error && (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Optional: Gib eine Anweisung, was genau verändert werden soll (z.B. „kürzer",
                    „mehr Beispiele", „formeller Ton"). Ohne Anweisung verbessert die KI den
                    Prompt nach Standard-Best-Practices.
                  </p>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    placeholder="Optional: Anweisung an die KI…"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm"
                  />
                  {loading && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      Verfeinere… (kann ein paar Sekunden dauern)
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={close}
                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={runRefine}
                      disabled={loading}
                      className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium"
                    >
                      {loading ? "Generiere…" : "✨ Verfeinern"}
                    </button>
                  </div>
                </>
              )}

              {error && (
                <>
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    {error}
                  </div>
                  {error.includes("Einstellungen") && (
                    <Link
                      href="/settings"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      → Zu den Einstellungen
                    </Link>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={close}
                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                    >
                      Schließen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setResult(null);
                      }}
                      className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                    >
                      Nochmal versuchen
                    </button>
                  </div>
                </>
              )}

              {result && result.refined && result.original && (
                <>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Modell: <code className="text-purple-600 dark:text-purple-400">{result.model}</code>
                  </div>

                  {renderDiff(result.original, result.refined)}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Verfeinerter Prompt (Vorschau, editierbar):
                    </label>
                    <textarea
                      value={result.refined}
                      onChange={(e) =>
                        setResult({ ...result, refined: e.target.value })
                      }
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none font-mono text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={close}
                      className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                    >
                      Verwerfen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        runRefine();
                      }}
                      className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg"
                    >
                      🔄 Erneut generieren
                    </button>
                    <button
                      type="button"
                      onClick={apply}
                      className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                    >
                      ✅ Übernehmen
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

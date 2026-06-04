"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ModelOption = { id: string; label: string; hint: string };

type RefinementRecord = {
  id: string;
  sourceText: string;
  refinedText: string;
  model: string;
  instruction: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: string;
};

type VariantState = {
  text: string;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: string;
  done: boolean;
};

type RefineButtonProps = {
  promptId: string;
  promptContent: string;
  modelOptions: ModelOption[];
  defaultModel: string;
  onApplied: (newContent: string) => void;
};

export function RefineButton({
  promptId,
  promptContent,
  modelOptions,
  defaultModel,
  onApplied,
}: RefineButtonProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ab" | "single">("ab");
  const [instruction, setInstruction] = useState("");

  // Pick a sensible default for modelB: any model that is NOT modelA.
  // We compute this lazily so that when modelOptions arrives asynchronously,
  // the dropdowns reflect the real list rather than the empty initial array.
  const initialModelB =
    modelOptions.find((m) => m.id !== defaultModel)?.id ?? defaultModel;
  const [modelA, setModelA] = useState(defaultModel);
  const [modelB, setModelB] = useState(initialModelB);

  // If modelOptions loads after mount, re-derive modelB so the user sees
  // a real second model in the dropdown instead of the fallback.
  useEffect(() => {
    if (modelOptions.length > 0 && modelB === defaultModel) {
      const candidate = modelOptions.find((m) => m.id !== modelA);
      if (candidate && candidate.id !== modelB) {
        setModelB(candidate.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelOptions]);

  const [running, setRunning] = useState(false);
  const [variants, setVariants] = useState<{ a: VariantState; b: VariantState }>(() =>
    makeEmpty(defaultModel, modelB)
  );
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<RefinementRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  function makeEmpty(a: string, b: string) {
    return {
      a: { text: "", model: a, done: false } as VariantState,
      b: { text: "", model: b, done: false } as VariantState,
    };
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/prompts/${promptId}/refinements?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.refinements ?? []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadHistory();
    return () => {
      abortRef.current?.abort();
    };
  }, [open, promptId]);

  function close() {
    abortRef.current?.abort();
    setOpen(false);
    setInstruction("");
    setError(null);
    setVariants(makeEmpty(modelA, modelB));
  }

  async function runRefine() {
    setError(null);
    setVariants(makeEmpty(modelA, modelB));
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/prompts/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId,
          instruction: instruction.trim() || undefined,
          modelA,
          modelB: mode === "ab" ? modelB : modelA,
          mode,
        }),
        signal: controller.signal,
      });

      if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        if (data.error?.includes("Kein Ollama API-Key")) {
          setError("Kein API-Key konfiguriert — bitte erst in den Einstellungen hinterlegen.");
        } else {
          setError(data.error || `Fehler ${res.status}`);
        }
        return;
      }
      if (!res.ok || !res.body) {
        setError(`Server-Fehler ${res.status}`);
        return;
      }

      // Parse SSE
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          let event = "message";
          let data = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (!data) continue;
          let payload: any;
          try { payload = JSON.parse(data); } catch { continue; }

          if (event === "meta") {
            setVariants((v) => ({
              a: { ...v.a, model: payload.modelA || v.a.model },
              b: { ...v.b, model: payload.modelB || v.b.model },
            }));
          } else if (event === "delta") {
            const variant = payload.variant === "b" ? "b" : "a";
            setVariants((v) => ({
              ...v,
              [variant]: { ...v[variant], text: v[variant].text + payload.text },
            }));
          } else if (event === "result") {
            const variant = payload.variant === "b" ? "b" : "a";
            setVariants((v) => ({
              ...v,
              [variant]: {
                ...v[variant],
                model: payload.model || v[variant].model,
                usage: payload.usage || v[variant].usage,
                error: payload.error,
                done: true,
              },
            }));
          } else if (event === "error") {
            setError(payload.message);
          } else if (event === "done") {
            // Mark both as done if not already
            setVariants((v) => ({
              a: v.a.done ? v.a : { ...v.a, done: true },
              b: v.b.done ? v.b : { ...v.b, done: true },
            }));
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("Abgebrochen");
      } else {
        setError(e instanceof Error ? e.message : "Netzwerkfehler");
      }
    } finally {
      setRunning(false);
    }
  }

  async function applyVariant(variant: "a" | "b") {
    const v = variants[variant];
    if (!v.text) return;

    // Persist the refinement, then propagate to the textarea
    try {
      const res = await fetch(`/api/prompts/${promptId}/refinements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText: promptContent,
          refinedText: v.text,
          model: v.model,
          instruction: instruction.trim() || null,
          promptTokens: v.usage?.prompt_tokens ?? null,
          completionTokens: v.usage?.completion_tokens ?? null,
          totalTokens: v.usage?.total_tokens ?? null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Speichern fehlgeschlagen");
        return;
      }
    } catch {
      // Non-fatal: still apply
    }
    onApplied(v.text);
    close();
  }

  async function restoreFromHistory(item: RefinementRecord) {
    onApplied(item.refinedText);
    close();
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
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                ✨ Prompt mit KI verfeinern
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((s) => !s)}
                  className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded"
                >
                  🕓 History ({history.length})
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-0">
                <div className="p-4 space-y-4">
                  {/* Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Modus
                      </label>
                      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setMode("ab")}
                          className={`flex-1 text-xs py-1.5 rounded ${
                            mode === "ab"
                              ? "bg-white dark:bg-gray-900 shadow font-medium"
                              : "text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          🆚 A/B
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode("single")}
                          className={`flex-1 text-xs py-1.5 rounded ${
                            mode === "single"
                              ? "bg-white dark:bg-gray-900 shadow font-medium"
                              : "text-gray-600 dark:text-gray-300"
                          }`}
                        >
                          1️⃣ Single
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Modell A {mode === "single" ? "(verwendet)" : ""}
                      </label>
                      <select
                        value={modelA}
                        onChange={(e) => setModelA(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                      >
                        {modelOptions.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {mode === "ab" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Modell B
                        </label>
                        <select
                          value={modelB}
                          onChange={(e) => setModelB(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                        >
                          {modelOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Optionale Anweisung
                    </label>
                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder='z.B. "kürzer", "mehr Beispiele", "formeller Ton"'
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                      {error}
                      {error.includes("Einstellungen") && (
                        <Link
                          href="/settings"
                          className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          → Zu den Einstellungen
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Variants */}
                  <div className={`grid gap-3 ${mode === "ab" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                    {(["a", "b"] as const).map((variant) => {
                      if (mode === "single" && variant === "b") return null;
                      const v = variants[variant];
                      return (
                        <div
                          key={variant}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col"
                        >
                          <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-purple-600 dark:text-purple-400">
                                {variant === "a" ? "🅰️ A" : "🅱️ B"}
                              </span>
                              <code className="text-gray-600 dark:text-gray-300">{v.model}</code>
                              {v.usage?.total_tokens != null && (
                                <span className="text-gray-400">
                                  · {v.usage.total_tokens} tokens
                                </span>
                              )}
                              {v.error && (
                                <span className="text-red-500">· Fehler: {v.error.slice(0, 30)}</span>
                              )}
                            </div>
                            {!running && v.text && !v.error && (
                              <button
                                type="button"
                                onClick={() => applyVariant(variant)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium"
                              >
                                ✅ Übernehmen
                              </button>
                            )}
                          </div>
                          <textarea
                            value={v.text}
                            onChange={(e) =>
                              setVariants((vs) => ({ ...vs, [variant]: { ...vs[variant], text: e.target.value } }))
                            }
                            readOnly={running && !v.text}
                            placeholder={running ? "Generiere…" : "Warte auf Generierung…"}
                            rows={mode === "ab" ? 14 : 18}
                            className="flex-1 w-full p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          {v.done && v.usage && (
                            <div className="px-3 py-1 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700">
                              Prompt: {v.usage.prompt_tokens ?? "?"} · Completion:{" "}
                              {v.usage.completion_tokens ?? "?"} · Total: {v.usage.total_tokens ?? "?"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* History Sidebar */}
                {historyOpen && (
                  <aside className="border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 overflow-y-auto">
                    <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">
                      🕓 Verlauf
                    </h3>
                    {historyLoading ? (
                      <p className="text-xs text-gray-500">Lädt…</p>
                    ) : history.length === 0 ? (
                      <p className="text-xs text-gray-500">Noch keine Verfeinerungen.</p>
                    ) : (
                      <ul className="space-y-2">
                        {history.map((r) => (
                          <li
                            key={r.id}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <code className="text-purple-600 dark:text-purple-400 truncate max-w-[140px]">
                                {r.model}
                              </code>
                              <time className="text-gray-400">
                                {new Date(r.createdAt).toLocaleString("de-DE", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </time>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 line-clamp-3 mb-1 font-mono whitespace-pre-wrap">
                              {r.refinedText.slice(0, 120)}
                              {r.refinedText.length > 120 ? "…" : ""}
                            </p>
                            <button
                              type="button"
                              onClick={() => restoreFromHistory(r)}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              ↩ Wiederherstellen
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </aside>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={runRefine}
                disabled={running}
                className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center gap-2"
              >
                {running && (
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {running
                  ? "Generiere…"
                  : mode === "ab"
                  ? "✨ A & B parallel generieren"
                  : "✨ Generieren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

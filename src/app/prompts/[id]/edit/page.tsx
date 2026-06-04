"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VariableHelper } from "@/app/variable-helper";
import { ThemeToggle } from "@/app/theme-toggle";
import { RefineButton } from "./refine-button";

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string | null;
  isPublic: boolean;
};

type ModelOption = { id: string; label: string; hint: string };

export default function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [defaultModel, setDefaultModel] = useState("minimax-m3:cloud");
  const [hasOllamaKey, setHasOllamaKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ id }, ollamaRes] = await Promise.all([
          params,
          fetch("/api/settings/ollama").catch(() => null),
        ]);
        const res = await fetch(`/api/prompts/${id}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 404 ? "Nicht gefunden" : "Laden fehlgeschlagen");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setPrompt(data);
        if (ollamaRes && ollamaRes.ok) {
          const ollama = await ollamaRes.json();
          setHasOllamaKey(!!ollama.hasKey);
          setDefaultModel(ollama.defaultModel || "minimax-m3:cloud");
          setModelOptions(ollama.modelOptions || []);
        }
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError("Fehler beim Laden");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt) return;
    setError(null);
    setSaving(true);

    const { id } = await params;
    const res = await fetch(`/api/prompts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: prompt.title,
        description: prompt.description,
        content: prompt.content,
        category: prompt.category,
        tags: prompt.tags,
        isPublic: prompt.isPublic,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Speichern fehlgeschlagen");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Lädt…</p>
      </main>
    );
  }

  if (error && !prompt) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            ← Zurück
          </Link>
        </div>
      </main>
    );
  }

  if (!prompt) return null;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Prompt bearbeiten
          </h1>
          <Link
            href="/"
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            ← Zurück
          </Link>
          <ThemeToggle />
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Titel *
            </label>
            <input
              type="text"
              value={prompt.title}
              onChange={(e) => setPrompt({ ...prompt, title: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Beschreibung
            </label>
            <input
              type="text"
              value={prompt.description ?? ""}
              onChange={(e) =>
                setPrompt({ ...prompt, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Inhalt *
              </label>
              {hasOllamaKey && modelOptions.length > 0 && (
                <RefineButton
                  promptId={prompt.id}
                  promptContent={prompt.content}
                  modelOptions={modelOptions}
                  defaultModel={defaultModel}
                  onApplied={(newContent) => setPrompt({ ...prompt, content: newContent })}
                />
              )}
              {!hasOllamaKey && (
                <Link
                  href="/settings"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ⚙️ Ollama-Key hinterlegen für KI-Verfeinerung
                </Link>
              )}
            </div>
            <textarea
              id="prompt-content"
              ref={contentRef}
              value={prompt.content}
              onChange={(e) => setPrompt({ ...prompt, content: e.target.value })}
              required
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
            />
            <VariableHelper
              content={prompt.content}
              onContentChange={(next) => setPrompt({ ...prompt, content: next })}
              textareaRef={contentRef}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kategorie
              </label>
              <input
                type="text"
                value={prompt.category ?? ""}
                onChange={(e) =>
                  setPrompt({ ...prompt, category: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tags
              </label>
              <input
                type="text"
                value={prompt.tags ?? ""}
                onChange={(e) => setPrompt({ ...prompt, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={prompt.isPublic}
              onChange={(e) =>
                setPrompt({ ...prompt, isPublic: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 bg-white dark:bg-gray-700"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">
              Öffentlich sichtbar
            </label>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition"
            >
              {saving ? "Wird gespeichert…" : "Änderungen speichern"}
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

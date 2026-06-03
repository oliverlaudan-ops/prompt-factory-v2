"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { extractVariables, renderTemplate } from "@/lib/prompt-variables";
import { ThemeToggle } from "@/app/theme-toggle";

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
};

export default function UsePromptPage({ params }: { params: Promise<{ id: string }> }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { id } = await params;
        const res = await fetch(`/api/prompts/${id}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 404 ? "Nicht gefunden" : "Laden fehlgeschlagen");
          setLoading(false);
          return;
        }
        const data: Prompt = await res.json();
        setPrompt(data);
        const vars = extractVariables(data.content);
        const initial: Record<string, string> = {};
        for (const v of vars) initial[v] = "";
        setValues(initial);
        setLoading(false);
      } catch {
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

  const rendered = useMemo(() => {
    if (!prompt) return "";
    return renderTemplate(prompt.content, values);
  }, [prompt, values]);

  const variables = useMemo(() => {
    if (!prompt) return [];
    return extractVariables(prompt.content);
  }, [prompt]);

  async function onCopy() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(rendered);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = rendered;
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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Lädt…</p>
      </main>
    );
  }

  if (error || !prompt) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || "Nicht gefunden"}
          </p>
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Zurück
          </Link>
        </div>
      </main>
    );
  }

  const hasVariables = variables.length > 0;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {prompt.title}
          </h1>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Zurück
            </Link>
          </div>
        </div>

        {prompt.description && (
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {prompt.description}
          </p>
        )}

        {hasVariables ? (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
              Variablen
            </h2>
            <div className="space-y-4">
              {variables.map((name) => (
                <div key={name}>
                  <label
                    htmlFor={`var-${name}`}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    {name}
                  </label>
                  <input
                    id={`var-${name}`}
                    type="text"
                    value={values[name] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [name]: e.target.value }))
                    }
                    placeholder={`Wert für ${name}…`}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Dieser Prompt enthält keine Variablen. Du kannst ihn trotzdem
              direkt in die Zwischenablage kopieren.
            </p>
          </div>
        )}

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
            Vorschau
          </h2>
          <pre className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
            {rendered}
          </pre>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCopy}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {copied ? "✓ Kopiert" : "📋 Kopieren"}
          </button>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Prompt = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string | null;
  tags: string | null;
  isPublic: boolean;
};

export default function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        const data = await res.json();
        setPrompt(data);
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
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Lädt…</p>
      </main>
    );
  }

  if (error && !prompt) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/" className="text-blue-600 hover:underline">
            ← Zurück
          </Link>
        </div>
      </main>
    );
  }

  if (!prompt) return null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Prompt bearbeiten</h1>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Zurück
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white rounded-2xl shadow p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titel *
            </label>
            <input
              type="text"
              value={prompt.title}
              onChange={(e) => setPrompt({ ...prompt, title: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschreibung
            </label>
            <input
              type="text"
              value={prompt.description ?? ""}
              onChange={(e) =>
                setPrompt({ ...prompt, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Inhalt *
            </label>
            <textarea
              value={prompt.content}
              onChange={(e) => setPrompt({ ...prompt, content: e.target.value })}
              required
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kategorie
              </label>
              <input
                type="text"
                value={prompt.category ?? ""}
                onChange={(e) =>
                  setPrompt({ ...prompt, category: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags
              </label>
              <input
                type="text"
                value={prompt.tags ?? ""}
                onChange={(e) => setPrompt({ ...prompt, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700">
              Öffentlich sichtbar
            </label>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
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
              className="px-5 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

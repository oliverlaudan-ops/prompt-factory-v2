"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/app/theme-toggle";

type ModelOption = { id: string; label: string; hint: string };

type SettingsResponse = {
  hasKey: boolean;
  defaultModel: string;
  modelOptions: ModelOption[];
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState("");
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/ollama");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Einstellungen konnten nicht geladen werden");
          setLoading(false);
          return;
        }
        const data: SettingsResponse = await res.json();
        setHasKey(data.hasKey);
        setDefaultModel(data.defaultModel);
        setModelOptions(data.modelOptions);
        setLoading(false);
      } catch {
        setError("Netzwerkfehler");
        setLoading(false);
      }
    })();
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setTestResult(null);
    if (!apiKey.trim()) {
      setError("Bitte einen API-Key eingeben");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/ollama", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim(), defaultModel }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Speichern fehlgeschlagen");
        return;
      }
      setHasKey(true);
      setApiKey("");
      setShowKey(false);
      setSuccess("API-Key gespeichert 🔒");
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setError(null);
    setSuccess(null);
    setTestResult(null);
    setTesting(true);
    try {
      const res = await fetch("/api/settings/ollama/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `✅ Verbindung OK (${data.models} Modelle verfügbar)`,
        });
      } else {
        setTestResult({
          ok: false,
          message: `❌ ${data.error || "Verbindung fehlgeschlagen"}`,
        });
      }
    } catch {
      setTestResult({ ok: false, message: "❌ Netzwerkfehler" });
    } finally {
      setTesting(false);
    }
  }

  async function onDelete() {
    if (!confirm("API-Key wirklich löschen?")) return;
    setError(null);
    setSuccess(null);
    setTestResult(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/ollama", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Löschen fehlgeschlagen");
        return;
      }
      setHasKey(false);
      setApiKey("");
      setSuccess("API-Key gelöscht");
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Lädt…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">⚙️ Einstellungen</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Zurück
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ollama Cloud</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Hinterlege deinen Ollama Cloud API-Key, um Prompts per KI verfeinern zu lassen.
              Der Key wird AES-256-GCM-verschlüsselt in der Datenbank gespeichert.
            </p>
            <a
              href="https://ollama.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              🔑 Key erstellen →
            </a>
          </div>

          <form onSubmit={onSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API-Key
              </label>
              <div className="flex gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasKey ? "• bereits hinterlegt — neuen Key eingeben zum Überschreiben" : "ollama-…"}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg"
                  aria-label={showKey ? "Key verbergen" : "Key anzeigen"}
                >
                  {showKey ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standard-Modell
              </label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.hint}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                {success}
              </div>
            )}
            {testResult && (
              <div
                className={`text-sm rounded-lg px-3 py-2 border ${
                  testResult.ok
                    ? "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                    : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                }`}
              >
                {testResult.message}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-lg transition"
              >
                {saving ? "Wird gespeichert…" : hasKey ? "Key aktualisieren" : "Key speichern"}
              </button>
              {hasKey && (
                <>
                  <button
                    type="button"
                    onClick={onTest}
                    disabled={testing}
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 font-medium px-5 py-2.5 rounded-lg transition"
                  >
                    {testing ? "Teste…" : "🔌 Verbindung testen"}
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting}
                    className="bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 disabled:opacity-50 text-red-700 dark:text-red-300 font-medium px-5 py-2.5 rounded-lg transition"
                  >
                    {deleting ? "Lösche…" : "🗑️ Key löschen"}
                  </button>
                </>
              )}
            </div>
          </form>
        </section>

        <section className="mt-6 bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ℹ️ Datenschutz</h2>
          <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1 list-disc list-inside">
            <li>Der Key wird mit AES-256-GCM verschlüsselt (Master-Key in <code>.env</code>).</li>
            <li>Beim Verfeinern wird dein Prompt an Ollama Cloud gesendet — prüfe deren Datenschutz.</li>
            <li>Weder Keys noch Prompt-Inhalte werden in Application-Logs geschrieben.</li>
            <li>Rate-Limit: 20 Verfeinerungen pro Stunde pro User.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}

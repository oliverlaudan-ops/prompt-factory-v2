"use client";

import { Suspense, useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    errorParam && !["Configuration", "SignOut"].includes(errorParam)
      ? "Anmeldung fehlgeschlagen. Bitte prüfe deine Daten."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError("E-Mail oder Passwort ist falsch.");
      return;
    }
    router.push(res?.url || callbackUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Bei Prompt Factory anmelden
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Multi-User-Prompt-Bibliothek
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            E-Mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
        >
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
      </form>

      <p className="mt-6 text-sm text-center text-gray-600 dark:text-gray-300">
        Noch kein Konto?{" "}
        <Link
          href="/auth/signup"
          className="text-blue-600 hover:underline font-medium"
        >
          Registrieren
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Suspense fallback={<div className="text-gray-500 dark:text-gray-400">Lädt…</div>}>
        <SignInForm />
      </Suspense>
    </main>
  );
}

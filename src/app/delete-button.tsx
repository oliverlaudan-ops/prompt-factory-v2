"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Diesen Prompt wirklich löschen?")) return;
    setBusy(true);
    const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Löschen fehlgeschlagen");
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
    >
      {busy ? "Lösche…" : "🗑 Löschen"}
    </button>
  );
}

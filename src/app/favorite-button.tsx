"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FavoriteButton({
  id,
  initial,
}: {
  id: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // optimistic update
    const next = !isFavorite;
    setIsFavorite(next);
    startTransition(async () => {
      const res = await fetch(`/api/prompts/${id}/favorite`, { method: "PATCH" });
      if (!res.ok) {
        // rollback
        setIsFavorite(!next);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      title={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      className="text-lg disabled:opacity-50 hover:scale-110 transition-transform"
    >
      {isFavorite ? "⭐" : "☆"}
    </button>
  );
}

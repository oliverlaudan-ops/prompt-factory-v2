"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700"
    >
      Abmelden
    </button>
  );
}

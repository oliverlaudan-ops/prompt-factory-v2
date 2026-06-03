"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  // The inline script in layout.tsx has already set the right class
  // on <html> before hydration, so reading the DOM is safe here.
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getInitialTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", next);
    } catch {
      // ignore — storage may be unavailable
    }
    setTheme(next);
  }

  // Avoid SSR/CSR text-mismatch warnings: render a stable placeholder
  // until we've read the real value from the DOM.
  const label = mounted
    ? theme === "dark"
      ? "☀️ Hell"
      : "🌙 Dunkel"
    : "🌙 Dunkel";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Auf helles Design wechseln" : "Auf dunkles Design wechseln"}
      aria-pressed={theme === "dark"}
      className="text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
    >
      {label}
    </button>
  );
}

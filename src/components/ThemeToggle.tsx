"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

const THEME_COOKIE = "theme=dark; path=/; max-age=31536000; SameSite=Lax";

/** Baca tema aktif dari class <html> (sudah diset script anti-FOUC). */
export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Terapkan tema ke <html> + simpan ke localStorage & cookie. */
export function applyTheme(theme: Theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem("theme", theme);
    document.cookie = dark ? THEME_COOKIE : "theme=light; path=/; max-age=31536000; SameSite=Lax";
  } catch {
    /* penyimpanan privat: tema tetap berlaku untuk sesi ini */
  }
}

/**
 * Tombol sun/moon yang BENAR-BENAR mengganti tema (class `dark` di <html>,
 * strategi Tailwind `darkMode: "class"`).
 */
export default function ThemeToggle({
  darkLabel = "Mode gelap",
  lightLabel = "Mode terang",
}: {
  darkLabel?: string;
  lightLabel?: string;
}) {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Dibaca setelah mount agar tidak ada hydration mismatch dengan SSR.
  useEffect(() => {
    setTheme(readTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={theme === null}
      title={isDark ? lightLabel : darkLabel}
      aria-label={isDark ? lightLabel : darkLabel}
      aria-pressed={isDark}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {theme === null ? null : isDark ? (
        // ikon matahari (sedang mode gelap → klik untuk ke terang)
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // ikon bulan (sedang mode terang → klik untuk ke gelap)
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}

"use client";

import type { Locale } from "@/i18n";

/**
 * Switcher bahasa ID/EN. BENAR-BENAR mengganti bahasa string yang ter-cover:
 * menulis cookie `locale` lalu reload penuh agar server component (atribut
 * lang di <html>) dan client component (window.__LOCALE__) membaca locale
 * yang sama.
 */
export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  function setLocale(next: Locale) {
    if (next === locale) return;
    try {
      document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* abaikan */
    }
    window.location.reload();
  }

  const opts: Locale[] = ["id", "en"];

  return (
    <div
      role="group"
      aria-label="Language / Bahasa"
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"
    >
      {opts.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={`rounded-lg px-2.5 py-1.5 uppercase tracking-wide transition ${
              active
                ? "bg-brand-500 text-white shadow-soft"
                : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

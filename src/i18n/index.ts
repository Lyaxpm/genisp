/**
 * Utilitas i18n sederhana berbasis cookie `locale` (id | en).
 *
 * CAKUPAN JUJUR: dictionary hanya mencakup string navigasi utama dashboard
 * (nav), halaman login (auth), string umum (common), dan header dashboard
 * (dashboard). Halaman-halaman lain MASIH memakai string Indonesia hardcoded
 * dan belum diterjemahkan — lihat pola pemakaian di bawah untuk menerapkannya.
 *
 * Pola pemakaian:
 *  - Server component:  const locale = getLocale(cookies().toString());
 *                        const dict = getDictionary(locale);
 *  - Client component:   const locale = getClientLocale(); // dibaca dari
 *                        window.__LOCALE__ yang diset script anti-FOUC di
 *                        layout root, tanpa flash bahasa
 *                        const dict = getDictionary(locale);
 *  - Ambil string:       dict.nav.pelanggan  atau  t(dict, "nav.pelanggan")
 */

import id from "./id.json";
import en from "./en.json";

export type Locale = "id" | "en";

const DICTS = { id, en } as const;
export type Dictionary = (typeof DICTS)["id"];

const LOCALE_RE = /(?:^|;\s*)locale=(id|en)\b/;

/** Baca locale dari string cookie (mis. document.cookie atau cookies().toString()). */
export function getLocale(cookieHeader: string | null | undefined): Locale {
  if (!cookieHeader) return "id";
  const m = cookieHeader.match(LOCALE_RE);
  return m ? (m[1] as Locale) : "id";
}

/** Baca locale di client tanpa flash: script boot di layout root sudah
 *  menulis window.__LOCALE__ sebelum React hydration. */
export function getClientLocale(): Locale {
  if (typeof window !== "undefined") {
    const w = window as unknown as { __LOCALE__?: string };
    if (w.__LOCALE__ === "en" || w.__LOCALE__ === "id") return w.__LOCALE__;
    if (typeof document !== "undefined") return getLocale(document.cookie);
  }
  return "id";
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTS[locale] ?? DICTS.id;
}

/** Ambil string lewat path "nav.pelanggan"; fallback ke kunci bila hilang. */
export function t(dict: Dictionary, path: string, fallback?: string): string {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return fallback ?? path;
    }
  }
  return typeof cur === "string" ? cur : fallback ?? path;
}

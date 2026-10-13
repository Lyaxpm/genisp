// Helper area settings (stream S13). File underscore → bukan route.
// ATURAN KERAS: secret (password/token/api key) tidak pernah disimpan di DB plain
// dan tidak pernah dikembalikan API. Secret hanya dari environment variable.
import { sql, type Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail } from "@/lib/utils";

export async function staff() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return null;
  return s;
}

export async function readSettings(db: Sql, keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = "";
  const rows = await db`select key, value from settings where key = any(${keys})`;
  for (const r of rows) out[r.key as string] = String(r.value ?? "");
  return out;
}

export async function writeSettings(db: Sql, pairs: Record<string, string>) {
  for (const [k, v] of Object.entries(pairs)) {
    await db`insert into settings (key, value) values (${k}, ${String(v ?? "")})
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  }
}

const SECRET_PATTERNS = [
  /password/i, /passwd/i, /secret/i, /token/i, /private[_-]?key/i,
  /api[_-]?key/i, /webhook/i, /callback[_-]?token/i,
];

/** true bila key terlihat seperti kredensial → harus di-mask / ditolak dari DB. */
export function looksSecret(key: string): boolean {
  return SECRET_PATTERNS.some((p) => p.test(key));
}

/**
 * Validasi body PUT: kembalikan fail() bila mengandung field yang terlihat
 * seperti secret. Dipakai route baru (email/telegram/integrations). Route lama
 * /api/settings sengaja TIDAK memakai ini agar fallback DB milik stream
 * gateway tetap jalan.
 */
export function assertNoSecrets(
  obj: Record<string, unknown> | null,
  area: string
): ReturnType<typeof fail> | null {
  for (const k of Object.keys(obj ?? {})) {
    if (looksSecret(k)) {
      return fail(
        `${area}: field "${k}" terlihat seperti secret — tidak boleh disimpan di database. Set via environment variable.`,
        400
      );
    }
  }
  return null;
}

export function toBool(v: unknown): string {
  return v === true || v === "true" || v === "1" || v === 1 ? "true" : "false";
}

// Daftar integrasi terkonfigurasi (staff). Secret di-MASK:
// API tidak pernah mengembalikan nilai secret — hanya "terisi"/"belum diset".
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import { staff } from "../settings/_lib";
import { INTEGRATIONS, configKey } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const keys: string[] = [];
  for (const i of INTEGRATIONS)
    for (const c of i.config) keys.push(configKey(i.key, c.key));
  const cfg: Record<string, string> = {};
  if (keys.length) {
    const rows = await db`select key, value from settings where key = any(${keys})`;
    for (const r of rows) cfg[r.key as string] = String(r.value ?? "");
  }
  const items = INTEGRATIONS.map((i) => ({
    key: i.key,
    name: i.name,
    description: i.description,
    secrets: i.secrets.map((s) => ({
      key: s.key,
      label: s.label,
      // MASK: nilai tidak pernah dikembalikan, hanya status keterisian.
      status: process.env[s.env] ? "terisi" : "belum diset",
    })),
    config: i.config.map((c) => ({
      key: c.key,
      label: c.label,
      type: c.type,
      options: c.options ?? [],
      value: cfg[configKey(i.key, c.key)] ?? c.default ?? "",
    })),
  }));
  return ok({ items });
}

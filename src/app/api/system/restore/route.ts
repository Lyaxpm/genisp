import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { BACKUP_TABLES } from "@/lib/system";

export const dynamic = "force-dynamic";

const IDENT = /^[a-z_][a-z0-9_]*$/i;

// POST {data: {tabel: rows[]}} — hapus isi tabel lalu insert ulang (superadmin only).
// Hanya tabel dalam allowlist yang diproses. Berjalan dalam satu transaksi.
export async function POST(req: NextRequest) {
  const s = await getSession("sistem");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  if (s.role !== "superadmin") return fail("Khusus superadmin", 403);
  const body = await req.json().catch(() => null);
  const data = body?.data as Record<string, unknown[]> | undefined;
  if (!data || typeof data !== "object" || Array.isArray(data))
    return fail("Format data tidak valid (butuh {data: {tabel: [...]}})", 400);

  const allowed = new Set<string>(BACKUP_TABLES as readonly string[]);
  const tables = Object.keys(data).filter((t) => allowed.has(t) && IDENT.test(t));
  if (!tables.length) return fail("Tidak ada tabel yang dikenal dalam data", 400);

  const db = sql();
  const restored: Record<string, number> = {};

  await db.begin(async (tx) => {
    // hapus: child dulu (urutan terbalik)
    for (const t of [...BACKUP_TABLES].reverse()) {
      if (!tables.includes(t)) continue;
      await tx.unsafe(`delete from "${t}"`);
    }
    // insert: parent dulu
    for (const t of BACKUP_TABLES) {
      if (!tables.includes(t)) continue;
      const rows = (data[t] ?? []).filter((r) => r && typeof r === "object") as Record<string, any>[];
      if (!rows.length) {
        restored[t] = 0;
        continue;
      }
      const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((c) => IDENT.test(c));
      if (!cols.length) {
        restored[t] = 0;
        continue;
      }
      const colList = cols.map((c) => `"${c}"`).join(", ");
      let n = 0;
      for (const r of rows) {
        const vals = cols.map((c) => (r[c] === undefined ? null : r[c]));
        const ph = vals.map((_, i) => `$${i + 1}`).join(", ");
        await tx.unsafe(`insert into "${t}" (${colList}) values (${ph})`, vals as never[]);
        n++;
      }
      restored[t] = n;
      // kembalikan sequence bila ada kolom id
      if (cols.includes("id")) {
        await tx.unsafe(
          `select setval(pg_get_serial_sequence('"${t}"','id'), coalesce((select max("id") from "${t}"), 0) + 1, false)`
        );
      }
    }
  });

  return ok({ restored });
}

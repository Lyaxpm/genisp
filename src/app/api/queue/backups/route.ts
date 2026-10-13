// GET /api/queue/backups — arsip hasil job db_backup (auth: staff).
//   ?id=123            → metadata satu backup
//   ?id=123&download=1 → unduh file SQL
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const q = req.nextUrl.searchParams;
  const id = q.get("id");

  if (id) {
    const rows = await db`select id, name, size_bytes, tables, row_count, status, error, created_at
      from backups where id = ${Number(id)} limit 1`;
    if (!rows.length) return fail("Backup tidak ditemukan", 404);
    if (q.get("download") === "1") {
      const full = await db`select name, data from backups where id = ${Number(id)} limit 1`;
      const name = String(full[0].name);
      return new NextResponse(String(full[0].data ?? ""), {
        status: 200,
        headers: {
          "Content-Type": "application/sql",
          "Content-Disposition": `attachment; filename="${name}"`,
        },
      });
    }
    return ok({ item: rows[0] });
  }

  const items = await db`select id, name, size_bytes, tables, row_count, status, error, created_at
    from backups order by id desc limit 50`;
  return ok({ items });
}

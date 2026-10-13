// /api/dashboard/kpi — KPI page-hit counter (tabel dashboard_hits).
// GET: tampilkan semua counter. POST {page}: increment counter halaman tsb.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select page, hits::bigint as hits, updated_at
    from dashboard_hits order by hits desc`;
  return ok({ items: rows.map((r) => ({ ...r, hits: Number(r.hits) })) });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const page = String(body?.page || "").trim().slice(0, 100);
  if (!page) return fail("Field 'page' wajib diisi", 400);
  const db = sql();
  const [row] = await db`insert into dashboard_hits (page, hits, updated_at)
    values (${page}, 1, now())
    on conflict (page) do update set hits = dashboard_hits.hits + 1, updated_at = now()
    returning page, hits::bigint as hits, updated_at`;
  return ok({ page: row.page, hits: Number(row.hits), updated_at: row.updated_at });
}

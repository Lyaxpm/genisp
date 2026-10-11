import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { testConnection } from "@/lib/routeros";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("router");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from routers where id = ${params.id}`;
  if (!rows.length) return fail("Router tidak ditemukan", 404);
  const r = rows[0];
  const t = await testConnection(r.host, r.api_port ?? 8728, 5000);
  if (t.ok) {
    await db`update routers set last_seen_at = now() where id = ${params.id}`;
    return ok({ reachable: true, latencyMs: t.latencyMs });
  }
  return fail("Tidak dapat terhubung ke router", 502, { latencyMs: t.latencyMs });
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET ?router_id=.. — daftar titik lokasi hotspot.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const routerId = req.nextUrl.searchParams.get("router_id");
  const items = routerId
    ? await db`select l.*, r.name as router_name from hotspot_locations l
        left join routers r on r.id = l.router_id
        where l.router_id = ${Number(routerId)} order by l.id asc`
    : await db`select l.*, r.name as router_name from hotspot_locations l
        left join routers r on r.id = l.router_id order by l.id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama lokasi wajib diisi", 400);
  const routerId = body?.router_id ? Number(body.router_id) : null;
  const db = sql();
  if (routerId) {
    const r = await db`select id from routers where id = ${routerId}`;
    if (!r.length) return fail("Router tidak ditemukan", 404);
  }
  const row = (
    await db`insert into hotspot_locations (name, router_id, address, notes)
      values (${String(body.name).trim()}, ${routerId}, ${body.address?.trim() || null}, ${body.notes?.trim() || null})
      returning *`
  )[0];
  return ok(row, 201);
}

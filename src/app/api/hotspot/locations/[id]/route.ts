import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const db = sql();
  const exists = await db`select id from hotspot_locations where id = ${Number(params.id)}`;
  if (!exists.length) return fail("Lokasi tidak ditemukan", 404);
  if (!body?.name?.trim()) return fail("Nama lokasi wajib diisi", 400);
  const routerId = body?.router_id ? Number(body.router_id) : null;
  if (routerId) {
    const r = await db`select id from routers where id = ${routerId}`;
    if (!r.length) return fail("Router tidak ditemukan", 404);
  }
  const row = (
    await db`update hotspot_locations
      set name = ${String(body.name).trim()}, router_id = ${routerId},
          address = ${body.address?.trim() || null}, notes = ${body.notes?.trim() || null}, updated_at = now()
      where id = ${Number(params.id)} returning *`
  )[0];
  return ok(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from hotspot_locations where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Lokasi tidak ditemukan", 404);
  return ok({ deleted: true });
}

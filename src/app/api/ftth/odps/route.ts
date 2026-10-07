import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const odc_id = sp.get("odc_id");
  const db = sql();
  const items = odc_id
    ? await db`select p.*, d.name as odc_name from odps p left join odcs d on d.id = p.odc_id
        where p.odc_id = ${odc_id} order by p.id asc`
    : await db`select p.*, d.name as odc_name from odps p left join odcs d on d.id = p.odc_id
        order by p.id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama ODP wajib diisi", 400);
  const db = sql();
  const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  const row = (
    await db`insert into odps (odc_id, name, capacity, address, latitude, longitude)
      values (${num(body.odc_id)}, ${String(body.name).trim()}, ${Number(body.capacity) || 8},
        ${body.address || null}, ${num(body.latitude)}, ${num(body.longitude)})
      returning *`
  )[0];
  return ok(row, 201);
}

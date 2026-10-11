import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession("ftth");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const olt_id = sp.get("olt_id");
  const db = sql();
  const items = olt_id
    ? await db`select d.*, o.name as olt_name from odcs d left join olts o on o.id = d.olt_id
        where d.olt_id = ${olt_id} order by d.id asc`
    : await db`select d.*, o.name as olt_name from odcs d left join olts o on o.id = d.olt_id
        order by d.id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession("ftth");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama ODC wajib diisi", 400);
  const db = sql();
  const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  const row = (
    await db`insert into odcs (olt_id, name, capacity, address, latitude, longitude)
      values (${num(body.olt_id)}, ${String(body.name).trim()}, ${Number(body.capacity) || 8},
        ${body.address || null}, ${num(body.latitude)}, ${num(body.longitude)})
      returning *`
  )[0];
  return ok(row, 201);
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const items = await db`select * from olts order by id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama OLT wajib diisi", 400);
  const db = sql();
  const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));
  const row = (
    await db`insert into olts (name, brand, host, location, latitude, longitude, is_active)
      values (${String(body.name).trim()}, ${body.brand || null}, ${body.host || null},
        ${body.location || null}, ${num(body.latitude)}, ${num(body.longitude)}, ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

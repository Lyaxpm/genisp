import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const db = sql();
  const items = q
    ? await db`select * from coverages where name ilike ${"%" + q + "%"} order by id desc`
    : await db`select * from coverages order by id desc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama area wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into coverages (name, description, area, is_active)
      values (${String(body.name).trim()}, ${body.description || null},
        ${body.area ? JSON.stringify(body.area) : null}::jsonb, ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

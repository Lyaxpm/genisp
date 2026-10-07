import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function staff() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return null;
  return s;
}

export async function GET(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const db = sql();
  const rows = q
    ? await db`select * from vendors where name ilike ${`%${q}%`} order by name asc`
    : await db`select * from vendors order by name asc`;
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama vendor wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into vendors (name, service, bandwidth, price, contact, notes, is_active)
      values (${String(body.name).trim()}, ${body.service || null}, ${body.bandwidth || null},
        ${Number(body.price) || 0}, ${body.contact || null}, ${body.notes || null}, ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

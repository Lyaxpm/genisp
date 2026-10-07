import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const items = await db`select * from services order by sort_order asc, id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return fail("Judul layanan wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into services (title, description, icon, sort_order, is_active)
      values (${String(body.title).trim()}, ${body.description || null}, ${body.icon || null},
        ${Number(body.sort_order) || 0}, ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

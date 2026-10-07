import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const items = await db`select * from slides order by sort_order asc, id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const db = sql();
  const row = (
    await db`insert into slides (title, subtitle, image_url, link_url, sort_order, is_active)
      values (${body?.title || null}, ${body?.subtitle || null}, ${body?.image_url || null},
        ${body?.link_url || null}, ${Number(body?.sort_order) || 0}, ${body?.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

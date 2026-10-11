import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession("hotspot");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const db = sql();
  const items = q
    ? await db`select * from hotspot_packages where name ilike ${"%" + q + "%"} order by price asc`
    : await db`select * from hotspot_packages order by price asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession("hotspot");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama paket wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into hotspot_packages (name, price, duration_hours, profile, description, is_active)
      values (${String(body.name).trim()}, ${Number(body.price) || 0}, ${Number(body.duration_hours) || 24},
        ${body.profile || null}, ${body.description || null}, ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

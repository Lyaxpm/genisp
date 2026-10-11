import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession("paket");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const active = sp.get("active");
  const db = sql();
  const params: unknown[] = [];
  let where = "where 1=1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and name ilike $${params.length}`;
  }
  if (active === "1") where += " and is_active = true";
  const items = await db.unsafe(`select * from packages ${where} order by price asc, id asc`, params as never[]);
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession("paket");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama paket wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into packages (name, category, price, speed_down, speed_up, description, is_active)
      values (${String(body.name).trim()}, ${body.category || "pppoe"}, ${Number(body.price) || 0},
        ${body.speed_down || null}, ${body.speed_up || null}, ${body.description || null},
        ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

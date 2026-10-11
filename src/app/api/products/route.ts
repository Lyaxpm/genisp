import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession("pengaturan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const db = sql();
  const items = q
    ? await db`select * from products where name ilike ${"%" + q + "%"} order by id desc`
    : await db`select * from products order by id desc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession("pengaturan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama produk wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into products (name, price, stock, description, image_url, is_active)
      values (${String(body.name).trim()}, ${Number(body.price) || 0}, ${Number(body.stock) || 0},
        ${body.description || null}, ${body.image_url || null}, ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

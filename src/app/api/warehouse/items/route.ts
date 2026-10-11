import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function staff() {
  const s = await getSession("gudang");
  if (!s || s.kind !== "staff") return null;
  return s;
}

export async function GET(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const typeId = sp.get("type_id")?.trim() ?? "";
  const db = sql();
  const params: unknown[] = [];
  let where = "where 1=1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and i.name ilike $${params.length}`;
  }
  if (typeId) {
    params.push(Number(typeId));
    where += ` and i.type_id = $${params.length}`;
  }
  const rows = await db.unsafe(
    `select i.*, it.name as type_name from items i
     left join item_types it on it.id = i.type_id
     ${where} order by i.name asc`,
    params as never[]
  );
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama barang wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into items (name, type_id, unit, stock, buy_price, sell_price, description)
      values (${String(body.name).trim()}, ${body.type_id || null}, ${body.unit || "pcs"},
        ${Math.max(0, Number(body.stock) || 0)}, ${Number(body.buy_price) || 0},
        ${Number(body.sell_price) || 0}, ${body.description || null})
      returning *`
  )[0];
  return ok(row, 201);
}

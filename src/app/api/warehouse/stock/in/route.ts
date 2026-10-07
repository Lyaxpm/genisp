import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Stok masuk manual (selain pembelian)
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const itemId = Number(body?.item_id);
  const qty = Math.floor(Number(body?.qty) || 0);
  if (!itemId || qty <= 0) return fail("Barang dan jumlah (>0) wajib diisi", 400);
  const db = sql();
  const item = (await db`select id, stock from items where id = ${itemId}`)[0];
  if (!item) return fail("Barang tidak ditemukan", 404);
  await db`update items set stock = stock + ${qty} where id = ${itemId}`;
  await db`insert into stock_moves (item_id, direction, qty, ref_type, notes, created_by)
    values (${itemId}, 'in', ${qty}, 'adjust', ${body.notes || null}, ${s.id})`;
  const updated = (await db`select stock from items where id = ${itemId}`)[0];
  return ok({ item_id: itemId, stock: updated.stock }, 201);
}

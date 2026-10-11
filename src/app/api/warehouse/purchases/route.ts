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
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const db = sql();
  const rows = q
    ? await db`select p.*, s.name as supplier_name from purchases p
        left join suppliers s on s.id = p.supplier_id
        where s.name ilike ${`%${q}%`} or p.notes ilike ${`%${q}%`}
        order by p.date desc, p.id desc limit 100`
    : await db`select p.*, s.name as supplier_name from purchases p
        left join suppliers s on s.id = p.supplier_id
        order by p.date desc, p.id desc limit 100`;
  return ok({ items: rows });
}

type PurchaseItem = { item_id: number; qty: number; price: number };

// POST { supplier_id?, date?, notes?, items: [{item_id, qty, price}] }
// → insert purchase + purchase_items + stok masuk otomatis + total.
export async function POST(req: NextRequest) {
  const s = await staff();
  if (!s) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items) ? (body.items as PurchaseItem[]) : [];
  const valid = items.filter((it) => Number(it.item_id) > 0 && Math.floor(Number(it.qty)) > 0);
  if (!valid.length) return fail("Minimal 1 barang dengan jumlah > 0", 400);
  const db = sql();

  const total = valid.reduce((sum, it) => sum + Math.floor(Number(it.qty)) * (Number(it.price) || 0), 0);
  const purchase = (
    await db`insert into purchases (supplier_id, date, total, notes, created_by)
      values (${body.supplier_id || null}, ${body.date || new Date().toISOString().slice(0, 10)},
        ${total}, ${body.notes || null}, ${s.id})
      returning *`
  )[0];

  for (const it of valid) {
    const qty = Math.floor(Number(it.qty));
    const price = Number(it.price) || 0;
    const item = (await db`select id from items where id = ${Number(it.item_id)}`)[0];
    if (!item) continue;
    await db`insert into purchase_items (purchase_id, item_id, qty, price)
      values (${purchase.id}, ${Number(it.item_id)}, ${qty}, ${price})`;
    await db`update items set stock = stock + ${qty} where id = ${Number(it.item_id)}`;
    await db`insert into stock_moves (item_id, direction, qty, ref_type, ref_id, created_by)
      values (${Number(it.item_id)}, 'in', ${qty}, 'purchase', ${purchase.id}, ${s.id})`;
  }
  return ok(purchase, 201);
}

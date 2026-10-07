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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select p.*, s.name as supplier_name from purchases p
    left join suppliers s on s.id = p.supplier_id where p.id = ${Number(params.id)}`;
  if (!rows.length) return fail("Pembelian tidak ditemukan", 404);
  const items = await db`select pi.*, i.name as item_name, i.unit from purchase_items pi
    join items i on i.id = pi.item_id where pi.purchase_id = ${Number(params.id)}`;
  return ok({ ...rows[0], items });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const id = Number(params.id);
  const items = await db`select item_id, qty from purchase_items where purchase_id = ${id}`;
  // Kembalikan stok yang dulu masuk dari pembelian ini (jangan sampai negatif)
  for (const it of items) {
    await db`update items set stock = greatest(0, stock - ${it.qty}) where id = ${it.item_id}`;
  }
  const rows = await db`delete from purchases where id = ${id} returning id`;
  if (!rows.length) return fail("Pembelian tidak ditemukan", 404);
  return ok({ deleted: true });
}

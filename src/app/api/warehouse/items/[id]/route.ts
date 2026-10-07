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
  const rows = await db`select i.*, it.name as type_name from items i
    left join item_types it on it.id = i.type_id where i.id = ${Number(params.id)}`;
  if (!rows.length) return fail("Barang tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama barang wajib diisi", 400);
  const db = sql();
  const rows = await db`update items set name = ${String(body.name).trim()},
    type_id = ${body.type_id || null}, unit = ${body.unit || "pcs"},
    buy_price = ${Number(body.buy_price) || 0}, sell_price = ${Number(body.sell_price) || 0},
    description = ${body.description || null}
    where id = ${Number(params.id)} returning *`;
  if (!rows.length) return fail("Barang tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from items where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Barang tidak ditemukan", 404);
  return ok({ deleted: true });
}

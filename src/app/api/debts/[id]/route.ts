import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const db = sql();
  const rows = await db`select d.*, c.name as customer_name, c.code as customer_code, c.phone as customer_phone
    from debts d join customers c on c.id = d.customer_id where d.id = ${id}`;
  if (!rows.length) return fail("Piutang tidak ditemukan", 404);
  const pays = await db`select * from debt_payments where debt_id = ${id} order by id asc`;
  return ok({ ...rows[0], payments: pays });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const db = sql();
  const cur = await db`select * from debts where id = ${id}`;
  if (!cur.length) return fail("Piutang tidak ditemukan", 404);
  if (["paid", "cancelled"].includes(cur[0].status))
    return fail("Piutang yang sudah lunas/batal tidak bisa diubah", 409);

  const amount = body?.amount !== undefined ? Number(body.amount) : Number(cur[0].amount);
  if (!amount || amount <= 0) return fail("Nominal tidak valid", 400);
  if (amount < Number(cur[0].paid_amount)) return fail("Nominal tidak boleh lebih kecil dari yang sudah dibayar", 400);

  const up = (
    await db`update debts set amount = ${amount},
      note = ${body?.note !== undefined ? body.note || null : cur[0].note},
      due_date = ${body?.due_date !== undefined ? body.due_date || null : cur[0].due_date}
      where id = ${id} returning *`
  )[0];
  return ok(up);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const db = sql();
  const cur = await db`select status from debts where id = ${id}`;
  if (!cur.length) return fail("Piutang tidak ditemukan", 404);
  if (Number((await db`select count(*)::int as c from debt_payments where debt_id = ${id}`)[0].c) > 0)
    return fail("Piutang yang sudah ada pembayaran tidak bisa dihapus (batalkan saja)", 409);
  await db`delete from debts where id = ${id}`;
  return ok({ deleted: id });
}

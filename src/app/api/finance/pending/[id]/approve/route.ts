import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PendingRow = {
  id: number;
  date: string;
  category_id: number | null;
  amount: number | string;
  description: string | null;
  payment_method: string | null;
  status: string;
  created_by: number | null;
};

// Setujui → masuk ke incomes + status approved.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("keuangan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from income_pending where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Data tidak ditemukan", 404);
  const p = rows[0] as unknown as PendingRow;
  if (p.status !== "pending") return fail("Sudah diproses sebelumnya", 400);

  await db`insert into incomes (date, category_id, amount, description, payment_method, created_by)
    values (${p.date}, ${p.category_id}, ${p.amount}, ${p.description}, ${p.payment_method}, ${p.created_by})`;
  const upd = (
    await db`update income_pending set status = 'approved', reviewed_by = ${s.id}, reviewed_at = now()
      where id = ${p.id} returning *`
  )[0];
  return ok(upd);
}

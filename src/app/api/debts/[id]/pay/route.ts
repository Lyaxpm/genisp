import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { getOrCreateIncomeCategory } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Bayar piutang (cicilan maupun lunas). Terhubung ke pencatatan income yang
// sudah ada (pola yang sama dipakai settle.ts untuk pelunasan invoice).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount ?? 0);
  const payment_method = String(body?.payment_method ?? "manual").trim() || "manual";
  if (!amount || amount <= 0) return fail("Nominal pembayaran tidak valid", 400);

  const db = sql();
  type PayRes =
    | { ok: true; debt: unknown; paid: number; remaining: number }
    | { ok: false; err: string; code: number };
  const res: PayRes = await db.begin(async (tx): Promise<PayRes> => {
    const rows = await tx`select d.*, c.name as customer_name
      from debts d join customers c on c.id = d.customer_id where d.id = ${id} for update`;
    if (!rows.length) return { ok: false, err: "Piutang tidak ditemukan", code: 404 };
    const d = rows[0];
    if (d.status === "paid") return { ok: false, err: "Piutang sudah lunas", code: 409 };
    if (d.status === "cancelled") return { ok: false, err: "Piutang sudah dibatalkan", code: 409 };

    const remaining = Number(d.amount) - Number(d.paid_amount);
    const pay = Math.min(amount, remaining);
    if (pay <= 0) return { ok: false, err: "Tidak ada sisa tagihan", code: 409 };

    await tx`insert into debt_payments (debt_id, amount, payment_method, notes, created_by)
      values (${id}, ${pay}, ${payment_method}, ${body?.notes || null}, ${s.id})`;

    const newPaid = Number(d.paid_amount) + pay;
    const full = newPaid >= Number(d.amount) - 0.005;
    const up = (
      await tx`update debts set paid_amount = ${newPaid},
        status = ${full ? "paid" : "partial"},
        paid_at = ${full ? "now()" : null}::timestamptz
        where id = ${id} returning *`
    )[0];

    // Catat ke income (konsisten dengan settle.ts: income kategori + payment_method).
    const catId = await getOrCreateIncomeCategory(tx as unknown as Parameters<typeof getOrCreateIncomeCategory>[0], "Piutang");
    await tx`insert into incomes (date, category_id, amount, description, payment_method, created_by)
      values (current_date, ${catId}, ${pay}, ${`Bayar piutang #${id} - ${String(d.customer_name ?? "")}`}, ${payment_method}, ${s.id})`;

    return { ok: true, debt: up, paid: pay, remaining: Number(d.amount) - newPaid };
  });

  if (!res.ok) return fail(res.err, res.code);
  return ok(res);
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyBniCallback } from "@/lib/gateways";
import { settleInvoiceByPayment, type PaymentRow } from "@/lib/settle";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = sql();
  let data;
  try {
    data = await verifyBniCallback((await req.json()) as Record<string, unknown>);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Token tidak valid", 401);
  }
  if (!data.vaNumber) return fail("Nomor VA tidak ditemukan di payload", 400);

  // Tandai transaksi VA lunas
  const vaRows = await db`select * from va_transaction where va_number = ${data.vaNumber}`;
  if (!vaRows.length) return ok({ received: true, matched: false });

  const trxId = (vaRows[0] as { trx_id: string }).trx_id;
  const rows = await db`select * from payments where gateway = 'bni' and external_id = ${trxId}`;
  if (!rows.length) return fail("Payment tidak ditemukan", 404);
  const r = await settleInvoiceByPayment(db, rows[0] as unknown as PaymentRow);
  await db`update va_transaction set status = 'PAID', paid_at = coalesce(paid_at, now()) where va_number = ${data.vaNumber}`;
  return ok({ received: true, settled: !r.already });
}

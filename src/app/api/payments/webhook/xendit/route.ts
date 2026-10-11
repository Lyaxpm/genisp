import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyXenditCallback } from "@/lib/gateways";
import { settleInvoiceByPayment as settlePayment, type PaymentRow } from "@/lib/settle";
import { ok, fail, rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = sql();
  let data;
  try {
    data = await verifyXenditCallback(req);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Signature tidak valid", 401);
  }
  if (!data.paid) return ok({ received: true, paid: false });
  const rows = await db`select * from payments where gateway = 'xendit' and external_id = ${data.externalId}`;
  if (!rows.length) return fail("Payment tidak ditemukan", 404);
  const r = await settlePayment(db, rows[0] as unknown as PaymentRow);
  return ok({ received: true, settled: !r.already });
}

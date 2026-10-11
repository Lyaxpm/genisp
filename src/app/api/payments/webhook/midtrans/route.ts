import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyMidtransSignature } from "@/lib/gateways";
import { settleInvoiceByPayment as settlePayment, type PaymentRow } from "@/lib/settle";
import { ok, fail, rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = sql();
  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body?.order_id || !body?.signature_key) return fail("Payload tidak valid", 400);
  try {
    await verifyMidtransSignature({
      orderId: String(body.order_id),
      statusCode: String(body.status_code ?? ""),
      grossAmount: String(body.gross_amount ?? ""),
      signatureKey: String(body.signature_key),
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Signature tidak valid", 401);
  }
  const txStatus = String(body.transaction_status ?? "");
  const fraud = String(body.fraud_status ?? "accept");
  const paid = ["capture", "settlement"].includes(txStatus) && fraud !== "deny";
  if (!paid) return ok({ received: true, paid: false });

  const rows = await db`select * from payments where gateway = 'midtrans' and external_id = ${String(body.order_id)}`;
  if (!rows.length) return fail("Payment tidak ditemukan", 404);
  const r = await settlePayment(db, rows[0] as unknown as PaymentRow);
  return ok({ received: true, settled: !r.already });
}

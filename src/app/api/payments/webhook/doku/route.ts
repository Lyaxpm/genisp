import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyDokuCallback, dokuResponseOk } from "@/lib/gateways";
import { settleInvoiceByPayment, type PaymentRow } from "@/lib/settle";
import { fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = sql();
  let data;
  try {
    data = await verifyDokuCallback(req);
  } catch (e) {
    return NextResponse.json(
      { responseCode: "4010000", responseMessage: e instanceof Error ? e.message : "Unauthorized" },
      { status: 401 }
    );
  }
  if (!data.paid || !data.invoiceNumber) {
    return NextResponse.json(dokuResponseOk({ received: true, paid: false }));
  }
  const rows = await db`select * from payments where gateway = 'doku' and external_id = ${data.invoiceNumber}`;
  if (!rows.length) return fail("Payment tidak ditemukan", 404);
  const r = await settleInvoiceByPayment(db, rows[0] as unknown as PaymentRow);
  return NextResponse.json(dokuResponseOk({ received: true, settled: !r.already }));
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { verifyMootaCallback } from "@/lib/gateways";
import { settleInvoiceByPayment, type PaymentRow } from "@/lib/settle";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = sql();
  let data;
  try {
    data = await verifyMootaCallback(req);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Signature tidak valid", 401);
  }
  if (!data.amount || data.amount <= 0) return ok({ received: true, matched: false });

  // Cocokkan mutasi kredit dengan payment pending yang nominalnya sama persis.
  // Ambil yang paling lama dibuat (FIFO) agar tidak salah pasang bila nominal kembar.
  const rows = await db`select p.* from payments p
    where p.gateway = 'moota' and p.status = 'pending' and p.amount = ${data.amount}
    order by p.created_at asc limit 1`;
  if (!rows.length) return ok({ received: true, matched: false, amount: data.amount });
  const r = await settleInvoiceByPayment(db, rows[0] as unknown as PaymentRow);
  return ok({ received: true, matched: true, settled: !r.already });
}

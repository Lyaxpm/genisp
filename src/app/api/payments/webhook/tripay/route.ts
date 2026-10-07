import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { notifyCustomer } from "@/lib/notify";
import { verifyTripayCallback } from "@/lib/gateways";
import { recordCommission } from "@/lib/commission";
import { ok, fail, rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getOrCreateIncomeCategory(db: Sql, name: string): Promise<number> {
  const rows = await db`select id from income_categories where name = ${name}`;
  if (rows.length) return rows[0].id as number;
  const ins = await db`insert into income_categories (name) values (${name}) returning id`;
  return ins[0].id as number;
}

type PaymentRow = {
  id: number;
  invoice_id: number;
  amount: number | string;
  gateway: string;
  status: string;
};

type InvoiceRow = {
  code: string;
  amount: number | string;
  customer_name: string;
  customer_phone: string | null;
};

async function settlePayment(db: Sql, payment: PaymentRow) {
  if (payment.status === "paid") return { already: true };
  await db`update payments set status = 'paid', paid_at = now() where id = ${payment.id}`;
  const inv = (
    await db`select i.*, c.name as customer_name, c.phone as customer_phone
      from invoices i join customers c on c.id = i.customer_id where i.id = ${payment.invoice_id}`
  )[0] as unknown as InvoiceRow;
  await db`update invoices set status = 'paid', paid_at = now(), payment_method = ${payment.gateway}
    where id = ${payment.invoice_id}`;
  const catId = await getOrCreateIncomeCategory(db, "Tagihan Internet");
  await db`insert into incomes (date, category_id, amount, description, payment_method)
    values (current_date, ${catId}, ${payment.amount}, ${"Pembayaran " + inv.code}, ${payment.gateway})`;
  // Komisi sales (best-effort, idempoten).
  try {
    await recordCommission(db, payment.invoice_id);
  } catch {
    /* abaikan */
  }
  // Notifikasi multi-channel (WA/SMS/Email) — pengganti kirim WA manual.
  try {
    await notifyCustomer(
      db,
      { name: inv.customer_name, phone: inv.customer_phone, email: null },
      "paid",
      { kode: inv.code, nominal: rupiah(inv.amount) }
    );
  } catch {
    /* abaikan */
  }
  return { already: false };
}

export async function POST(req: NextRequest) {
  const db = sql();
  let data;
  try {
    data = await verifyTripayCallback(req);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Signature tidak valid", 401);
  }
  if (!data.paid) return ok({ received: true, paid: false });
  const rows = await db`select * from payments where gateway = 'tripay' and external_id = ${data.merchantRef}`;
  if (!rows.length) return fail("Payment tidak ditemukan", 404);
  const r = await settlePayment(db, rows[0] as unknown as PaymentRow);
  return ok({ received: true, settled: !r.already });
}

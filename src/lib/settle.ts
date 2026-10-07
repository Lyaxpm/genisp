// Settle terpusat untuk semua webhook payment gateway.
// Pola sama seperti webhook xendit/midtrans/tripay, ditambah pencatatan komisi.
import type { Sql } from "./db";
import { getOrCreateIncomeCategory } from "./finance";
import { recordCommission } from "./commission";
import { trySendWhatsapp } from "./notify";
import { rupiah } from "./utils";

export type PaymentRow = {
  id: number;
  invoice_id: number;
  amount: number | string;
  gateway: string;
  status: string;
};

export type InvoiceRow = {
  code: string;
  amount: number | string;
  customer_name: string;
  customer_phone: string | null;
};

/**
 * Lunasi invoice dari sebuah payment row.
 * Idempoten: bila payment sudah paid, tidak melakukan apa pun (already: true).
 */
export async function settleInvoiceByPayment(db: Sql, payment: PaymentRow) {
  if (payment.status === "paid") return { already: true };

  await db`update payments set status = 'paid', paid_at = now() where id = ${payment.id}`;

  const inv = (
    await db`select i.*, c.name as customer_name, c.phone as customer_phone
      from invoices i join customers c on c.id = i.customer_id
      where i.id = ${payment.invoice_id}`
  )[0] as unknown as InvoiceRow;

  await db`update invoices set status = 'paid', paid_at = now(), payment_method = ${payment.gateway}
    where id = ${payment.invoice_id}`;

  const catId = await getOrCreateIncomeCategory(db, "Tagihan Internet");
  await db`insert into incomes (date, category_id, amount, description, payment_method)
    values (current_date, ${catId}, ${payment.amount}, ${"Pembayaran " + inv.code}, ${payment.gateway})`;

  // Komisi sales/partner (no-op bila tidak ada sales/fee yang cocok)
  try {
    await recordCommission(db, payment.invoice_id);
  } catch {
    /* komisi tidak boleh menggagalkan settle */
  }

  if (inv.customer_phone) {
    try {
      await trySendWhatsapp(
        inv.customer_phone,
        `Terima kasih ${inv.customer_name}, pembayaran ${inv.code} sebesar ${rupiah(inv.amount)} sudah kami terima. Lunas!`
      );
    } catch {
      /* abaikan */
    }
  }
  return { already: false };
}

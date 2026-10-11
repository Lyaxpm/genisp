import type { Sql, TransactionSql } from "./db";
import { getOrCreateIncomeCategory } from "./finance";
import { recordCommission } from "./commission";
import { notifyCustomer } from "./notify";
import { debitWallet, getOrCreateWallet } from "./wallet";
import { rupiah } from "./utils";

export type PaymentRow = { id: number; invoice_id: number; amount: number | string; gateway: string; status: string };
type Notice = { name: string; phone: string | null; email: string | null; code: string; amount: number | string };
export type Settlement = { already: boolean; notice?: Notice; payment?: PaymentRow };

// All invoice settlement paths lock invoice FIRST, then payment, then wallet.
// This also serializes different payment attempts for the same invoice.
export async function settleInTransaction(tx: TransactionSql, paymentId: number, createdBy: number | null = null): Promise<Settlement> {
  const [ref] = await tx`select invoice_id from payments where id = ${paymentId}`;
  if (!ref) throw new Error("Payment tidak ditemukan");
  const [invoice] = await tx`select * from invoices where id = ${ref.invoice_id} for update`;
  const [payment] = await tx`select * from payments where id = ${paymentId} for update`;
  if (!invoice || !payment) throw new Error("Invoice/payment tidak ditemukan");
  if (payment.status === "paid") return { already: true };
  if (invoice.status === "paid") {
    // Keep a second external payment visible for reconciliation/refund; never debit wallet again.
    await tx`update payments set status = 'review', raw = coalesce(raw, '{}'::jsonb) || '{"review_reason":"invoice_already_paid"}'::jsonb
      where id = ${paymentId}`;
    return { already: true };
  }
  if (invoice.status === "cancelled") throw new Error("Invoice dibatalkan; pembayaran perlu rekonsiliasi");
  const amount = Number(payment.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Nominal pembayaran tidak valid");
  if (payment.gateway === "wallet" && amount > 0) {
    const wallet = await getOrCreateWallet(tx, "customer", Number(invoice.customer_id));
    await debitWallet(tx, wallet.id, amount, "invoice_payment", payment.id, `Bayar invoice ${invoice.code}`);
  }
  await tx`update payments set status = 'paid', paid_at = now() where id = ${paymentId}`;
  await tx`update invoices set status = 'paid', paid_at = now(), payment_method = ${payment.gateway} where id = ${invoice.id}`;
  const category = await getOrCreateIncomeCategory(tx, "Tagihan Internet");
  await tx`insert into incomes (date, category_id, amount, description, payment_method, created_by)
    values (current_date, ${category}, ${payment.amount}, ${"Pembayaran " + invoice.code}, ${payment.gateway}, ${createdBy})`;
  await recordCommission(tx, Number(invoice.id));
  const [customer] = await tx`select name, phone, email from customers where id = ${invoice.customer_id}`;
  return {
    already: false,
    payment: { ...payment, status: "paid" } as PaymentRow,
    notice: customer ? { name: customer.name, phone: customer.phone, email: customer.email, code: invoice.code, amount: payment.amount } : undefined,
  };
}

// Network I/O happens only after the financial transaction commits.
export async function sendSettlementNotice(db: Sql, result: Settlement) {
  if (!result.notice) return;
  const n = result.notice;
  try {
    await notifyCustomer(db, n, "paid", { kode: n.code, nominal: rupiah(n.amount) });
  } catch { /* Notification failure must not roll back a paid invoice. */ }
}

export async function settleInvoiceByPayment(db: Sql, payment: PaymentRow) {
  const result = await db.begin(tx => settleInTransaction(tx, payment.id));
  await sendSettlementNotice(db, result);
  return { already: result.already };
}

export async function payInvoiceManually(tx: TransactionSql, invoiceId: number, amount: number | undefined, method: string, createdBy: number | null = null): Promise<Settlement> {
  const [invoice] = await tx`select * from invoices where id = ${invoiceId} for update`;
  if (!invoice) throw new Error("Invoice tidak ditemukan");
  if (invoice.status === "paid") return { already: true };
  const paid = amount ?? Number(invoice.amount);
  if (!Number.isFinite(paid) || paid <= 0 || paid < Number(invoice.amount)) throw new Error("Nominal kurang dari tagihan atau tidak valid");
  const [payment] = await tx`insert into payments (invoice_id, gateway, amount, status)
    values (${invoiceId}, 'manual', ${paid}, 'pending') returning *`;
  const result = await settleInTransaction(tx, Number(payment.id), createdBy);
  await tx`update invoices set payment_method = ${method} where id = ${invoiceId}`;
  return result;
}

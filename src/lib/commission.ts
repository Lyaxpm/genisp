import type { Sql } from "./db";

type InvoiceSalesRow = {
  id: number;
  amount: number | string;
  customer_id: number;
  sales_id: number | null;
};

type FeeRow = {
  id: number;
  name: string;
  type: "percent" | "fixed";
  value: number | string;
};

/**
 * Catat komisi sales saat sebuah invoice lunas.
 * Idempoten: tidak membuat duplikat bila komisi untuk invoice tsb sudah ada.
 * Aturan: pakai sales_fees aktif pertama (percent|fixed); fallback ke
 * settings.commission_default (persen) bila tidak ada fee aktif.
 */
export async function recordCommission(
  db: Sql,
  invoiceId: number
): Promise<{ created: boolean; amount: number }> {
  const existing = await db`select id from commissions where invoice_id = ${invoiceId}`;
  if (existing.length) return { created: false, amount: 0 };

  const invRows = await db`select i.id, i.amount, i.customer_id, c.sales_id
    from invoices i join customers c on c.id = i.customer_id
    where i.id = ${invoiceId}`;
  if (!invRows.length) return { created: false, amount: 0 };
  const inv = invRows[0] as unknown as InvoiceSalesRow;
  if (!inv.sales_id) return { created: false, amount: 0 };

  const feeRows = await db`select * from sales_fees where is_active = true order by id asc limit 1`;
  let amount = 0;
  if (feeRows.length) {
    const fee = feeRows[0] as unknown as FeeRow;
    amount =
      fee.type === "percent"
        ? (Number(inv.amount) * Number(fee.value)) / 100
        : Number(fee.value);
  } else {
    const sRows = await db`select value from settings where key = 'commission_default'`;
    const defPct = sRows.length ? Number(sRows[0].value) || 0 : 0;
    amount = (Number(inv.amount) * defPct) / 100;
  }
  if (amount <= 0) return { created: false, amount: 0 };

  await db`insert into commissions (invoice_id, customer_id, sales_id, amount, status)
    values (${inv.id}, ${inv.customer_id}, ${inv.sales_id}, ${Math.round(amount)}, 'pending')`;
  return { created: true, amount: Math.round(amount) };
}

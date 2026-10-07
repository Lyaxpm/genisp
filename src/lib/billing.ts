import type { Sql } from "./db";
import { invoiceCode, periodLabel, rupiah } from "./utils";
import { notifyCustomer } from "./notify";

// Generate invoice untuk semua pelanggan aktif yang belum punya invoice di periode tsb.
// Dipakai oleh POST /api/invoices/generate dan cron harian.
export async function generateInvoicesForPeriod(
  db: Sql,
  period: string,
  createdBy: number | null
) {
  const comp = (await db`select invoice_prefix from company where id = 1`)[0];
  const prefix = comp?.invoice_prefix ?? "INV";
  const [{ count }] = await db`select count(*)::int as count from invoices`;
  const customers = await db`select c.*, p.price as package_price, p.name as package_name
    from customers c left join packages p on p.id = c.package_id
    where c.status = 'aktif'
      and not exists (select 1 from invoices i where i.customer_id = c.id and i.period = ${period})
    order by c.id asc`;
  let seq = count as number;
  const created = [];
  for (const cust of customers) {
    seq++;
    const code = invoiceCode(prefix, new Date(), seq);
    const amount = Number(cust.package_price ?? 0);
    if (amount <= 0) continue;
    const day = Math.min(28, Math.max(1, Number(cust.due_day) || 10));
    const due = `${period}-${String(day).padStart(2, "0")}`;
    const inv = (
      await db`insert into invoices (code, customer_id, period, amount, due_date, created_by)
        values (${code}, ${cust.id}, ${period}, ${amount}, ${due}, ${createdBy}) returning *`
    )[0];
    const desc = `Paket internet ${(cust.package_name ?? "").trim()} periode ${periodLabel(period)}`
      .replace(/\s+/g, " ")
      .trim();
    await db`insert into invoice_items (invoice_id, description, qty, price)
      values (${inv.id}, ${desc}, 1, ${amount})`;
    created.push(inv);
    // Notifikasi tagihan baru (WA/SMS/Email sesuai pengaturan). Jangan gagalkan generate.
    try {
      await notifyCustomer(
        db,
        { name: cust.name, phone: cust.phone, email: cust.email },
        "bill",
        {
          kode: code,
          periode: periodLabel(period),
          nominal: rupiah(amount),
          jatuh_tempo: due,
        }
      );
    } catch {
      /* abaikan */
    }
  }
  return created;
}

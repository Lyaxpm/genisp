import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { trySendWhatsapp } from "@/lib/notify";
import { ok, fail, rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getOrCreateIncomeCategory(db: Sql, name: string): Promise<number> {
  const rows = await db`select id from income_categories where name = ${name}`;
  if (rows.length) return rows[0].id as number;
  const ins = await db`insert into income_categories (name) values (${name}) returning id`;
  return ins[0].id as number;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "").trim();
  if (!["approve", "reject"].includes(action)) return fail("action harus approve|reject", 400);

  const db = sql();
  const rows = await db`select cp.*, i.code as invoice_code, i.status as invoice_status, i.amount as invoice_amount,
      c.name as customer_name, c.phone as customer_phone
    from confirm_payments cp join invoices i on i.id = cp.invoice_id
    join customers c on c.id = i.customer_id where cp.id = ${params.id}`;
  if (!rows.length) return fail("Konfirmasi tidak ditemukan", 404);
  const cp = rows[0];
  if (cp.status !== "pending") return fail("Konfirmasi sudah direview", 400);

  if (action === "reject") {
    await db`update confirm_payments set status = 'rejected', reviewed_by = ${s.id}, reviewed_at = now()
      where id = ${params.id}`;
    return ok({ reviewed: "rejected" });
  }

  // approve -> lunasi invoice
  if (cp.invoice_status !== "paid") {
    await db`update invoices set status = 'paid', paid_at = now(), payment_method = 'transfer' where id = ${cp.invoice_id}`;
    await db`insert into payments (invoice_id, gateway, amount, status, paid_at)
      values (${cp.invoice_id}, 'manual', ${cp.amount}, 'paid', now())`;
    const catId = await getOrCreateIncomeCategory(db, "Tagihan Internet");
    await db`insert into incomes (date, category_id, amount, description, payment_method, created_by)
      values (current_date, ${catId}, ${cp.amount}, ${"Pembayaran " + cp.invoice_code}, 'transfer', ${s.id})`;
    if (cp.customer_phone) {
      try {
        await trySendWhatsapp(
          cp.customer_phone,
          `Terima kasih ${cp.customer_name}, konfirmasi pembayaran ${cp.invoice_code} sebesar ${rupiah(cp.amount)} disetujui. Lunas!`
        );
      } catch {
        /* abaikan */
      }
    }
  }
  await db`update confirm_payments set status = 'approved', reviewed_by = ${s.id}, reviewed_at = now()
    where id = ${params.id}`;
  return ok({ reviewed: "approved" });
}

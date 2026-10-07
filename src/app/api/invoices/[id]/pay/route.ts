import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notifyCustomer } from "@/lib/notify";
import { getOrCreateIncomeCategory } from "@/lib/finance";
import { recordCommission } from "@/lib/commission";
import { ok, fail, rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const method = String(body?.method ?? "tunai");
  const db = sql();

  const rows = await db`select i.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
    from invoices i join customers c on c.id = i.customer_id where i.id = ${params.id}`;
  if (!rows.length) return fail("Invoice tidak ditemukan", 404);
  const inv = rows[0];
  if (inv.status === "paid") return fail("Invoice sudah lunas", 400);

  const amount =
    body?.amount !== undefined && body?.amount !== "" ? Number(body.amount) : Number(inv.amount);
  if (!amount || amount <= 0) return fail("Nominal pembayaran tidak valid", 400);
  if (amount < Number(inv.amount)) return fail("Nominal kurang dari total tagihan", 400);

  await db`update invoices set status = 'paid', paid_at = now(), payment_method = ${method} where id = ${params.id}`;
  const pay = (
    await db`insert into payments (invoice_id, gateway, amount, status, paid_at)
      values (${params.id}, 'manual', ${amount}, 'paid', now()) returning *`
  )[0];
  const catId = await getOrCreateIncomeCategory(db, "Tagihan Internet");
  await db`insert into incomes (date, category_id, amount, description, payment_method, created_by)
    values (current_date, ${catId}, ${amount}, ${"Pembayaran " + inv.code}, ${method}, ${s.id})`;

  // Komisi sales (best-effort, idempoten).
  try {
    await recordCommission(db, Number(params.id));
  } catch {
    /* abaikan */
  }

  // Notifikasi multi-channel (WA/SMS/Email) — pengganti kirim WA manual.
  try {
    await notifyCustomer(
      db,
      {
        name: String(inv.customer_name ?? ""),
        phone: (inv.customer_phone as string | null) ?? null,
        email: (inv.customer_email as string | null) ?? null,
      },
      "paid",
      { kode: String(inv.code), nominal: rupiah(amount) }
    );
  } catch {
    /* abaikan */
  }
  return ok({ invoice_id: Number(params.id), payment: pay });
}

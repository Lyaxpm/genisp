import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail, invoiceCode, periodLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Konversi draft menjadi invoice resmi dengan penomoran dari billing.ts (invoiceCode).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const db = sql();
  type FinRes = { ok: true; invoice: unknown } | { ok: false; err: string; code: number };

  const result: FinRes = await db.begin(async (tx): Promise<FinRes> => {
    const rows = await tx`select * from invoice_drafts where id = ${id} for update`;
    if (!rows.length) return { ok: false, err: "Draft tidak ditemukan", code: 404 };
    const d = rows[0];
    if (d.status !== "draft") return { ok: false, err: "Draft tidak dalam status draft", code: 409 };

    const dup = await tx`select id from invoices where customer_id = ${d.customer_id} and period = ${d.period}`;
    if (dup.length) return { ok: false, err: "Invoice periode ini sudah ada", code: 409 };

    const comp = (await tx`select invoice_prefix from company where id = 1`)[0];
    const prefix = comp?.invoice_prefix ?? "INV";
    const [{ count }] = await tx`select count(*)::int as count from invoices`;
    const code = invoiceCode(prefix, new Date(), (count as number) + 1);

    const amount = Number(d.amount);
    const discount = Number(d.discount);
    const unique_code = Number(body?.unique_code ?? d.unique_code ?? 0);
    const unique_amount = amount + unique_code - discount;

    const inv = (
      await tx`insert into invoices (code, customer_id, period, amount, discount, unique_code, unique_amount, due_date, notes, created_by)
        values (${code}, ${d.customer_id}, ${d.period}, ${amount}, ${discount}, ${unique_code}, ${unique_amount}, ${d.due_date || body?.due_date || `${d.period}-10`}, ${d.notes}, ${s.id})
        returning *`
    )[0];

    const items = await tx`select * from invoice_draft_items where draft_id = ${id} order by id asc`;
    if (items.length) {
      for (const it of items) {
        await tx`insert into invoice_items (invoice_id, description, qty, price)
          values (${inv.id}, ${it.description}, ${it.qty}, ${it.price})`;
      }
    } else {
      const desc = `Paket internet periode ${periodLabel(d.period)}`.trim();
      await tx`insert into invoice_items (invoice_id, description, qty, price)
        values (${inv.id}, ${desc}, 1, ${amount})`;
    }

    await tx`update invoice_drafts set status = 'finalized', finalized_invoice_id = ${inv.id}, updated_at = now() where id = ${id}`;
    return { ok: true, invoice: inv };
  });

  if (!result.ok) return fail(result.err, result.code);
  return ok(result.invoice, 201);
}

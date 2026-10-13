import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Daftar draft invoice.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and (c.name ilike $${params.length} or c.code ilike $${params.length} or d.period ilike $${params.length})`;
  }
  if (status) {
    params.push(status);
    where += ` and d.status = $${params.length}`;
  }
  const from = "invoice_drafts d join customers c on c.id = d.customer_id";
  const totalRows = await db.unsafe(`select count(*)::int as total from ${from} ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select d.*, c.name as customer_name, c.code as customer_code
     from ${from} ${where} order by d.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

// Buat draft invoice baru (belum punya nomor resmi).
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const customer_id = Number(body?.customer_id);
  const period = String(body?.period ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const discount = Number(body?.discount ?? 0);
  if (!customer_id || !/^\d{4}-\d{2}$/.test(period))
    return fail("customer_id dan period (YYYY-MM) wajib diisi", 400);
  if (!amount || amount <= 0) return fail("Nominal draft tidak valid", 400);
  if (discount < 0 || discount > amount) return fail("Diskon tidak valid", 400);

  const db = sql();
  const cust = await db`select id from customers where id = ${customer_id}`;
  if (!cust.length) return fail("Pelanggan tidak ditemukan", 404);

  const items: { description: string; qty: number; price: number }[] = Array.isArray(body?.items)
    ? body.items
    : [];

  const draft = await db.begin(async (tx) => {
    const d = (
      await tx`insert into invoice_drafts (customer_id, period, amount, discount, due_date, notes, created_by)
        values (${customer_id}, ${period}, ${amount}, ${discount}, ${body?.due_date || null}, ${body?.notes || null}, ${s.id})
        returning *`
    )[0];
    const rows = items.length
      ? items.map((it) => ({
          description: String(it.description ?? "").trim(),
          qty: Number(it.qty) || 1,
          price: Number(it.price) || 0,
        }))
      : [
          {
            description: `Tagihan periode ${period}`,
            qty: 1,
            price: amount,
          },
        ];
    for (const r of rows) {
      if (!r.description) continue;
      await tx`insert into invoice_draft_items (draft_id, description, qty, price)
        values (${d.id}, ${r.description}, ${r.qty}, ${r.price})`;
    }
    return d;
  });
  return ok(draft, 201);
}

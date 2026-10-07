import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail, invoiceCode, periodLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const period = sp.get("period")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and (i.code ilike $${params.length} or c.name ilike $${params.length} or c.code ilike $${params.length} or c.phone ilike $${params.length})`;
  }
  if (status) {
    params.push(status);
    where += ` and i.status = $${params.length}`;
  }
  if (period) {
    params.push(period);
    where += ` and i.period = $${params.length}`;
  }
  const from = "invoices i join customers c on c.id = i.customer_id";
  const totalRows = await db.unsafe(`select count(*)::int as total from ${from} ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select i.*, c.name as customer_name, c.code as customer_code, c.phone as customer_phone
     from ${from} ${where} order by i.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const customer_id = Number(body?.customer_id);
  const period = String(body?.period ?? "").trim();
  if (!customer_id || !/^\d{4}-\d{2}$/.test(period))
    return fail("customer_id dan period (YYYY-MM) wajib diisi", 400);

  const db = sql();
  const cust = await db`select c.*, p.price as package_price, p.name as package_name
    from customers c left join packages p on p.id = c.package_id where c.id = ${customer_id}`;
  if (!cust.length) return fail("Pelanggan tidak ditemukan", 404);
  const dup = await db`select id from invoices where customer_id = ${customer_id} and period = ${period}`;
  if (dup.length) return fail("Invoice periode ini sudah ada", 409);

  const c = cust[0];
  const amount = body?.amount !== undefined && body?.amount !== "" ? Number(body.amount) : Number(c.package_price ?? 0);
  if (!amount || amount <= 0) return fail("Nominal invoice tidak valid", 400);

  const comp = (await db`select invoice_prefix from company where id = 1`)[0];
  const prefix = comp?.invoice_prefix ?? "INV";
  const [{ count }] = await db`select count(*)::int as count from invoices`;
  const code = invoiceCode(prefix, new Date(), (count as number) + 1);

  const day = Math.min(28, Math.max(1, Number(c.due_day) || 10));
  const due_date = body?.due_date || `${period}-${String(day).padStart(2, "0")}`;

  const inv = (
    await db`insert into invoices (code, customer_id, period, amount, due_date, notes, created_by)
      values (${code}, ${customer_id}, ${period}, ${amount}, ${due_date}, ${body?.notes || null}, ${s.id})
      returning *`
  )[0];
  const desc = `Paket internet ${(c.package_name ?? "").trim()} periode ${periodLabel(period)}`.replace(/\s+/g, " ").trim();
  await db`insert into invoice_items (invoice_id, description, qty, price)
    values (${inv.id}, ${desc}, 1, ${amount})`;
  return ok(inv, 201);
}

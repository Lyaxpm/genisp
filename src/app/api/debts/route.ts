import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Daftar piutang.
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
    where += ` and (c.name ilike $${params.length} or c.code ilike $${params.length} or d.note ilike $${params.length})`;
  }
  if (status) {
    params.push(status);
    where += ` and d.status = $${params.length}`;
  }
  const from = "debts d join customers c on c.id = d.customer_id";
  const totalRows = await db.unsafe(`select count(*)::int as total from ${from} ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select d.*, c.name as customer_name, c.code as customer_code, c.phone as customer_phone
     from ${from} ${where} order by d.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

// Catat piutang baru.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const customer_id = Number(body?.customer_id);
  const amount = Number(body?.amount ?? 0);
  if (!customer_id || !amount || amount <= 0) return fail("customer_id dan amount (>0) wajib diisi", 400);

  const db = sql();
  const cust = await db`select id from customers where id = ${customer_id}`;
  if (!cust.length) return fail("Pelanggan tidak ditemukan", 404);

  const d = (
    await db`insert into debts (customer_id, amount, note, due_date, created_by)
      values (${customer_id}, ${amount}, ${body?.note || null}, ${body?.due_date || null}, ${s.id}) returning *`
  )[0];
  return ok(d, 201);
}

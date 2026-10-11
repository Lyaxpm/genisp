import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function resolveCategory(db: Sql, category_id: unknown, category: unknown): Promise<number | null> {
  if (category_id) return Number(category_id);
  const name = String(category ?? "").trim();
  if (!name) return null;
  const rows = await db`select id from expenditure_categories where name = ${name}`;
  if (rows.length) return rows[0].id as number;
  const ins = await db`insert into expenditure_categories (name) values (${name}) returning id`;
  return ins[0].id as number;
}

export async function GET(req: NextRequest) {
  const s = await getSession("keuangan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from")?.trim() ?? "";
  const to = sp.get("to")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (from) {
    params.push(from);
    where += ` and e.date >= $${params.length}`;
  }
  if (to) {
    params.push(to);
    where += ` and e.date <= $${params.length}`;
  }
  if (q) {
    params.push(`%${q}%`);
    where += ` and e.description ilike $${params.length}`;
  }
  const fromSql = "expenditures e left join expenditure_categories c on c.id = e.category_id";
  const totalRows = await db.unsafe(`select count(*)::int as total from ${fromSql} ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select e.*, c.name as category_name from ${fromSql} ${where}
     order by e.date desc, e.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  const sumRows = await db.unsafe(`select coalesce(sum(e.amount),0) as total from ${fromSql} ${where}`, params.slice(0, -2) as never[]);
  return ok({ items, total: totalRows[0].total as number, sum: Number(sumRows[0].total), page, limit });
}

export async function POST(req: NextRequest) {
  const s = await getSession("keuangan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!amount || amount <= 0) return fail("Nominal pengeluaran wajib diisi", 400);
  const db = sql();
  const category_id = await resolveCategory(db, body?.category_id, body?.category);
  const row = (
    await db`insert into expenditures (date, category_id, amount, description, payment_method, created_by)
      values (${body?.date || new Date().toISOString().slice(0, 10)}, ${category_id}, ${amount},
        ${body?.description || null}, ${body?.payment_method || null}, ${s.id})
      returning *`
  )[0];
  return ok(row, 201);
}

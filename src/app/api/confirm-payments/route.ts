import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (status) {
    params.push(status);
    where += ` and cp.status = $${params.length}`;
  }
  const fromSql = `confirm_payments cp join invoices i on i.id = cp.invoice_id
    join customers c on c.id = i.customer_id`;
  const totalRows = await db.unsafe(`select count(*)::int as total from ${fromSql} ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select cp.*, i.code as invoice_code, i.amount as invoice_amount, c.name as customer_name
     from ${fromSql} ${where} order by cp.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

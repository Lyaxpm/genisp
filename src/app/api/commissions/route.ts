import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const salesId = sp.get("sales_id")?.trim() ?? "";
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (status) {
    params.push(status);
    where += ` and cm.status = $${params.length}`;
  }
  if (salesId) {
    params.push(Number(salesId));
    where += ` and cm.sales_id = $${params.length}`;
  }
  const rows = await db.unsafe(
    `select cm.*, u.name as sales_name, c.name as customer_name, i.code as invoice_code
     from commissions cm
     left join users u on u.id = cm.sales_id
     left join customers c on c.id = cm.customer_id
     left join invoices i on i.id = cm.invoice_id
     ${where} order by cm.id desc`,
    params as never[]
  );
  const sumRows = await db.unsafe(
    `select cm.status, coalesce(sum(cm.amount),0) as total from commissions cm ${where} group by cm.status`,
    params as never[]
  );
  return ok({ items: rows, summary: sumRows });
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select i.*, c.code as customer_code, c.name as customer_name, c.phone as customer_phone,
      c.address as customer_address, p.name as package_name
    from invoices i
    join customers c on c.id = i.customer_id
    left join packages p on p.id = c.package_id
    where i.id = ${params.id}`;
  if (!rows.length) return fail("Invoice tidak ditemukan", 404);
  const invoice = rows[0];
  const items = await db`select * from invoice_items where invoice_id = ${params.id} order by id asc`;
  const payments = await db`select * from payments where invoice_id = ${params.id} order by id desc`;
  return ok({ invoice, items, payments });
}

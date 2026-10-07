import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const code = sp.get("code")?.trim() ?? "";
  const phone = sp.get("phone")?.trim() ?? "";
  if (!code && !phone) return fail("Parameter code atau phone wajib diisi", 400);
  const db = sql();

  const rows = code
    ? await db`select c.id, c.code, c.name, c.status, p.name as package_name
        from customers c left join packages p on p.id = c.package_id where c.code = ${code}`
    : await db`select c.id, c.code, c.name, c.status, p.name as package_name
        from customers c left join packages p on p.id = c.package_id where c.phone = ${phone}`;
  if (!rows.length) return fail("Data pelanggan tidak ditemukan", 404);

  const customer = rows[0];
  const invoices = await db`select code, period, amount, due_date, status
    from invoices where customer_id = ${customer.id} and status = 'unpaid' order by due_date asc`;
  return ok({ customer, invoices });
}

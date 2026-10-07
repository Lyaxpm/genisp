import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();

  const cust = await db`select count(*)::int as total,
      count(*) filter (where status = 'aktif')::int as aktif,
      count(*) filter (where status = 'isolir')::int as isolir,
      count(*) filter (where status = 'pending')::int as pending,
      count(*) filter (where status = 'nonaktif')::int as nonaktif
    from customers`;
  const inv = await db`select count(*) filter (where status = 'unpaid')::int as unpaid_count,
      coalesce(sum(amount) filter (where status = 'unpaid'),0) as unpaid_total,
      count(*) filter (where status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', now()))::int as paid_this_month_count,
      coalesce(sum(amount) filter (where status = 'paid' and date_trunc('month', paid_at) = date_trunc('month', now())),0) as paid_this_month_total
    from invoices`;
  const inc = await db`select coalesce(sum(amount),0) as total from incomes
    where date >= date_trunc('month', current_date)`;
  const vch = await db`select count(*)::int as total from vouchers where status = 'active'`;

  return ok({
    customers: cust[0],
    invoices: {
      unpaid_count: inv[0].unpaid_count,
      unpaid_total: Number(inv[0].unpaid_total),
      paid_this_month_count: inv[0].paid_this_month_count,
      paid_this_month_total: Number(inv[0].paid_this_month_total),
    },
    income_this_month: Number(inc[0].total),
    vouchers_active: vch[0].total,
  });
}

// GET /api/dashboard/badges — tab badges dashboard.
// Semua angka agregat langsung dari DB (customers, invoices, help_tickets, income_pending).
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();

  const [cust] = await db`select
      count(*)::int as total,
      count(*) filter (where status = 'aktif')::int as aktif,
      count(*) filter (where status = 'nonaktif')::int as nonaktif,
      count(*) filter (where status = 'isolir')::int as isolir,
      count(*) filter (where status = 'pending')::int as pending
    from customers`;

  const [inv] = await db`select
      count(*) filter (where status = 'unpaid')::int as unpaid_count,
      coalesce(sum(amount) filter (where status = 'unpaid'), 0) as unpaid_total
    from invoices`;

  const [tix] = await db`select
      count(*) filter (where status in ('open','process'))::int as open_count
    from help_tickets`;

  const [pend] = await db`select
      count(*) filter (where status = 'pending')::int as pending_count,
      coalesce(sum(amount) filter (where status = 'pending'), 0) as pending_total
    from income_pending`;

  return ok({
    customers: {
      total: cust.total,
      aktif: cust.aktif,
      nonaktif: cust.nonaktif,
      isolir: cust.isolir,
      pending: cust.pending,
    },
    invoices_unpaid: {
      count: inv.unpaid_count,
      total: Number(inv.unpaid_total),
    },
    tickets_open: tix.open_count,
    pending_income: {
      count: pend.pending_count,
      total: Number(pend.pending_total),
    },
  });
}

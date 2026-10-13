import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MM = /^\d{4}-\d{2}$/;

function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

// Rekonsiliasi: invoice vs payments vs income per bulan dalam periode.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const from = sp.get("from") ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const to = sp.get("to") ?? from;
  if (!MM.test(from) || !MM.test(to) || from > to) return fail("from/to harus YYYY-MM dan from <= to", 400);

  const db = sql();
  const months = monthRange(from, to);
  const rows = await db`select
      i.period as period,
      coalesce(sum(i.amount),0)::float8 as invoiced,
      coalesce(sum(i.discount),0)::float8 as discount,
      count(*) filter (where i.status = 'paid')::int as paid_count,
      coalesce(sum(i.amount) filter (where i.status = 'paid'),0)::float8 as paid_invoiced,
      coalesce((select sum(p.amount) from payments p where p.status = 'paid'
        and to_char(p.paid_at, 'YYYY-MM') = i.period),0)::float8 as payments_paid
    from invoices i where i.period between ${from} and ${to} group by i.period order by i.period`;
  const inc = await db`select to_char(inc.date, 'YYYY-MM') as period,
      coalesce(sum(inc.amount),0)::float8 as income_total
    from incomes inc where to_char(inc.date, 'YYYY-MM') between ${from} and ${to}
    group by 1 order by 1`;

  const byMonth = new Map(months.map((m) => [m, {
    period: m,
    invoiced: 0,
    discount: 0,
    paid_count: 0,
    paid_invoiced: 0,
    payments_paid: 0,
    income: 0,
  }]));
  for (const r of rows) {
    const m = byMonth.get(r.period ?? "");
    if (m) Object.assign(m, {
      invoiced: Number(r.invoiced),
      discount: Number(r.discount),
      paid_count: r.paid_count,
      paid_invoiced: Number(r.paid_invoiced),
      payments_paid: Number(r.payments_paid),
    });
  }
  for (const r of inc) {
    const m = byMonth.get(r.period ?? "");
    if (m) m.income = Number(r.income_total);
  }

  const items = Array.from(byMonth.values()).map((m) => ({
    ...m,
    selisih: Number((m.paid_invoiced - m.payments_paid).toFixed(2)),
  }));
  const total = items.reduce(
    (a, m) => ({
      invoiced: a.invoiced + m.invoiced,
      discount: a.discount + m.discount,
      paid_invoiced: a.paid_invoiced + m.paid_invoiced,
      payments_paid: a.payments_paid + m.payments_paid,
      income: a.income + m.income,
    }),
    { invoiced: 0, discount: 0, paid_invoiced: 0, payments_paid: 0, income: 0 }
  );
  return ok({ from, to, items, total });
}

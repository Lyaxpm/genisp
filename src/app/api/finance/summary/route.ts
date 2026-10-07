import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const from = sp.get("from") ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const to = sp.get("to") ?? now.toISOString().slice(0, 10);
  const db = sql();

  const inc = await db`select coalesce(sum(amount),0) as total from incomes where date >= ${from} and date <= ${to}`;
  const exp = await db`select coalesce(sum(amount),0) as total from expenditures where date >= ${from} and date <= ${to}`;
  const income = Number(inc[0].total);
  const expenditure = Number(exp[0].total);

  const byIncome = await db`select coalesce(c.name,'Tanpa kategori') as category, coalesce(sum(i.amount),0) as total
    from incomes i left join income_categories c on c.id = i.category_id
    where i.date >= ${from} and i.date <= ${to} group by c.name order by total desc`;
  const byExpenditure = await db`select coalesce(c.name,'Tanpa kategori') as category, coalesce(sum(e.amount),0) as total
    from expenditures e left join expenditure_categories c on c.id = e.category_id
    where e.date >= ${from} and e.date <= ${to} group by c.name order by total desc`;

  return ok({
    from,
    to,
    income,
    expenditure,
    balance: income - expenditure,
    byCategory: {
      income: byIncome.map((r) => ({ category: r.category, total: Number(r.total) })),
      expenditure: byExpenditure.map((r) => ({ category: r.category, total: Number(r.total) })),
    },
  });
}

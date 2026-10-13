// GET /api/dashboard/pending-income — widget pemasukan pending (approval).
// Sumber: tabel income_pending. Hanya data DB nyata.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();

  const [agg] = await db`select
      count(*) filter (where status = 'pending')::int as pending_count,
      coalesce(sum(amount) filter (where status = 'pending'), 0) as pending_total
    from income_pending`;

  const items = await db`select ip.id, ip.date, ip.amount, ip.description,
      ip.payment_method, ip.status, ip.created_at,
      ic.name as category_name, u.name as created_by_name
    from income_pending ip
    left join income_categories ic on ic.id = ip.category_id
    left join users u on u.id = ip.created_by
    where ip.status = 'pending'
    order by ip.created_at desc
    limit 50`;

  return ok({
    pending_count: agg.pending_count,
    pending_total: Number(agg.pending_total),
    items: items.map((r) => ({ ...r, amount: Number(r.amount) })),
  });
}

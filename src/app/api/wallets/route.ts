import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Daftar semua wallet (staff).
export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select w.*,
      case when w.owner_type = 'customer' then c.name else p.name end as owner_name,
      case when w.owner_type = 'customer' then c.phone else p.phone end as owner_phone
    from wallet_accounts w
    left join customers c on c.id = w.owner_id and w.owner_type = 'customer'
    left join partners p on p.id = w.owner_id and w.owner_type = 'partner'
    order by w.updated_at desc`;
  return ok(rows);
}

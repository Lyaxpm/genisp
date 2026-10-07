import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "partner") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select id, name, email, phone, commission_percent, wallet_balance, is_active, created_at
    from partners where id = ${s.id}`;
  if (!rows.length) return fail("Data partner tidak ditemukan", 404);
  return ok(rows[0]);
}

import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "partner") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select wallet_balance from partners where id = ${s.id}`;
  if (!rows.length) return fail("Data partner tidak ditemukan", 404);
  const transactions = await db`select * from wallet_transactions where partner_id = ${s.id}
    order by id desc limit 50`;
  return ok({ wallet_balance: Number(rows[0].wallet_balance), transactions });
}

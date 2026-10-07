import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getLedger } from "@/lib/wallet";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Detail wallet + riwayat ledger (staff).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from wallet_accounts where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Wallet tidak ditemukan", 404);
  const ledger = await getLedger(db, Number(params.id), 50);
  return ok({ wallet: rows[0], ledger });
}

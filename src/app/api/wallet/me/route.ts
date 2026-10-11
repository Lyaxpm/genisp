import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getLedger, getOrCreateWallet } from "@/lib/wallet";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Wallet milik member yang sedang login.
export async function GET() {
  const s = await getSession("wallet");
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);
  const db = sql();
  const wallet = await getOrCreateWallet(db, "customer", s.id);
  const ledger = await getLedger(db, wallet.id, 20);
  return ok({ wallet, ledger });
}

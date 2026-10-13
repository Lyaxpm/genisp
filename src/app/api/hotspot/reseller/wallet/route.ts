import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getOrCreateWallet, getLedger } from "@/lib/wallet";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET: info wallet reseller — saldo + riwayat ledger.
// Reseller melihat milik sendiri; staff bisa via ?partner_id=..
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return fail("Unauthorized", 401);
  let resellerId: number | null = null;
  if (s.kind === "partner") resellerId = s.id;
  else if (s.kind === "staff" && req.nextUrl.searchParams.get("partner_id"))
    resellerId = Number(req.nextUrl.searchParams.get("partner_id"));
  if (!resellerId) return fail("partner_id wajib diisi", 400);
  const db = sql();
  const w = await getOrCreateWallet(db, "partner", resellerId);
  const ledger = await getLedger(db, w.id, 50);
  const pendingTopups = await db`select count(*)::int as n from reseller_topups
    where reseller_id = ${resellerId} and status = 'pending'`;
  return ok({
    balance: Number(w.balance),
    points: Number(w.points),
    pending_topups: (pendingTopups[0] as Record<string, unknown>).n as number,
    ledger,
  });
}

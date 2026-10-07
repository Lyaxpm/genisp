import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { creditWallet } from "@/lib/wallet";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

type TopupRow = {
  id: number;
  wallet_id: number;
  amount: number | string;
  status: string;
};

// Staff/internal: verifikasi topup manual → saldo masuk ke wallet.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from wallet_topups where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Topup tidak ditemukan", 404);
  const topup = rows[0] as unknown as TopupRow;
  if (topup.status === "paid") return ok({ already: true });

  await db`update wallet_topups set status = 'paid', paid_at = now() where id = ${topup.id}`;
  const balanceAfter = await creditWallet(
    db,
    topup.wallet_id,
    Number(topup.amount),
    "topup",
    topup.id,
    `Topup saldo (verifikasi ${s.name})`,
    s.id
  );
  return ok({ settled: true, balance_after: balanceAfter });
}

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { settleWalletTopup } from "@/lib/wallet";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Staff/internal: verifikasi topup manual → saldo masuk ke wallet.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("wallet");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  try {
    const result = await settleWalletTopup(db, Number(params.id), s.id, s.name);
    return ok(result);
  } catch (e) { return fail(e instanceof Error ? e.message : "Topup gagal", 400); }
}

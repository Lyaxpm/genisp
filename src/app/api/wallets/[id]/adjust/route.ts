import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { creditWallet, debitWallet } from "@/lib/wallet";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Staff: tambah/kurangi saldo manual.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("wallet");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const type = String(body?.type ?? "");
  const amount = Number(body?.amount);
  const description = String(body?.description ?? "").trim() || null;
  if (!["credit", "debit"].includes(type)) return fail("type harus credit|debit", 400);
  if (!amount || amount <= 0) return fail("Nominal tidak valid", 400);

  const db = sql();
  const exists = await db`select id from wallet_accounts where id = ${Number(params.id)}`;
  if (!exists.length) return fail("Wallet tidak ditemukan", 404);

  try {
    const balanceAfter =
      type === "credit"
        ? await creditWallet(db, Number(params.id), amount, "adjust", undefined, description ?? `Adjust manual oleh ${s.name}`, s.id)
        : await debitWallet(db, Number(params.id), amount, "adjust", undefined, description ?? `Adjust manual oleh ${s.name}`, s.id);
    return ok({ balance_after: balanceAfter });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal adjust saldo", 400);
  }
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getOrCreateWallet, creditWallet } from "@/lib/wallet";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST: admin memproses pengajuan top up reseller.
// { request_id, action: "approve" | "reject" }
// approve → kredit wallet reseller via wallet.ts (tercatat di ledger), anti double-proses.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const requestId = Number(body?.request_id);
  const action = String(body?.action ?? "");
  if (!requestId || (action !== "approve" && action !== "reject"))
    return fail("request_id dan action (approve|reject) wajib diisi", 400);
  const db = sql();
  const rows = await db`select * from reseller_topups where id = ${requestId}`;
  if (!rows.length) return fail("Pengajuan tidak ditemukan", 404);
  const t = rows[0] as Record<string, unknown>;
  if (t.status !== "pending") return fail("Pengajuan sudah diproses sebelumnya", 400);

  const resellerId = Number(t.reseller_id);
  const amount = Number(t.amount);

  if (action === "reject") {
    await db`update reseller_topups set status = 'rejected', processed_by = ${s.id}, processed_at = now()
      where id = ${requestId} and status = 'pending'`;
    await db`insert into activity_logs (action, detail)
      values ('reseller-topup-reject', ${`request=${requestId} reseller=${resellerId} amount=${amount} by=${s.id}`})`.catch(() => null);
    return ok({ request_id: requestId, status: "rejected", message: "Pengajuan ditolak." });
  }

  // approve: kredit wallet reseller (ledger tercatat di wallet_ledger).
  const w = await getOrCreateWallet(db, "partner", resellerId);
  const balanceAfter = await creditWallet(
    db,
    w.id,
    amount,
    "reseller_topup",
    requestId,
    `Approve pengajuan top up reseller #${requestId}`,
    s.id
  );
  await db`update reseller_topups set status = 'approved', processed_by = ${s.id}, processed_at = now()
    where id = ${requestId} and status = 'pending'`;
  await db`insert into activity_logs (action, detail)
    values ('reseller-topup-approve', ${`request=${requestId} reseller=${resellerId} amount=${amount} balance_after=${balanceAfter} by=${s.id}`})`.catch(() => null);
  return ok({
    request_id: requestId,
    status: "approved",
    reseller_id: resellerId,
    amount,
    balance_after: balanceAfter,
    message: "Pengajuan disetujui & saldo wallet reseller bertambah.",
  });
}

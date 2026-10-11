import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { payInvoiceManually, sendSettlementNotice } from "@/lib/settle";
import { ok, fail } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("konfirmasi");
  if (!s || s.kind !== "staff") return fail("Akses ditolak", 403);
  const body = await req.json().catch(() => null);
  if (!["approve", "reject"].includes(body?.action)) return fail("action harus approve|reject", 400);
  const db = sql();
  try {
    const result = await db.begin(async tx => {
      const [cp] = await tx`select * from confirm_payments where id = ${params.id} for update`;
      if (!cp) throw new Error("Konfirmasi tidak ditemukan");
      if (cp.status !== "pending") throw new Error("Konfirmasi sudah direview");
      const settled = body.action === "approve" ? await payInvoiceManually(tx, Number(cp.invoice_id), Number(cp.amount), "transfer", s.id) : null;
      if (settled?.already) throw new Error("Invoice sudah lunas; periksa kemungkinan pembayaran ganda");
      const status = body.action === "approve" ? "approved" : "rejected";
      await tx`update confirm_payments set status = ${status}, reviewed_by = ${s.id}, reviewed_at = now() where id = ${params.id}`;
      return { status, settled };
    });
    if (result.settled) await sendSettlementNotice(db, result.settled);
    return ok({ reviewed: result.status });
  } catch (e) { return fail(e instanceof Error ? e.message : "Review gagal", 400); }
}

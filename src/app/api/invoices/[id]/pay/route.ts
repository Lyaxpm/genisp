import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { payInvoiceManually, sendSettlementNotice } from "@/lib/settle";
import { ok, fail } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("tagihan");
  if (!s || s.kind !== "staff") return fail("Akses ditolak", 403);
  const body = await req.json().catch(() => null);
  const amount = body?.amount === undefined || body?.amount === "" ? undefined : Number(body.amount);
  const db = sql();
  try {
    const result = await db.begin(tx => payInvoiceManually(tx, Number(params.id), amount, String(body?.method ?? "tunai"), s.id));
    await sendSettlementNotice(db, result);
    return ok({ invoice_id: Number(params.id), payment: result.payment, already: result.already });
  } catch (e) { return fail(e instanceof Error ? e.message : "Pembayaran gagal", 400); }
}

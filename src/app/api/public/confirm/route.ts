import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const invoice_code = String(body?.invoice_code ?? "").trim();
  const sender_name = String(body?.sender_name ?? "").trim();
  const amount = Number(body?.amount);
  if (!invoice_code || !sender_name || !amount || amount <= 0)
    return fail("invoice_code, sender_name, dan amount wajib diisi", 400);

  const db = sql();
  const inv = await db`select id, status from invoices where code = ${invoice_code}`;
  if (!inv.length) return fail("Invoice tidak ditemukan", 404);
  if (inv[0].status === "paid") return fail("Invoice sudah lunas", 400);

  const row = (
    await db`insert into confirm_payments (invoice_id, sender_name, amount, proof_url)
      values (${inv[0].id}, ${sender_name}, ${amount}, ${body?.proof_url || null})
      returning id, invoice_id, sender_name, amount, status, created_at`
  )[0];
  return ok({ submitted: true, confirmation: row }, 201);
}

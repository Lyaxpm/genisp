import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const type = String(body?.type ?? "").trim();
  const amount = Number(body?.amount);
  const description = String(body?.description ?? "").trim() || null;
  if (!["credit", "debit"].includes(type)) return fail("type harus credit|debit", 400);
  if (!amount || amount <= 0) return fail("Nominal tidak valid", 400);

  const db = sql();
  const rows = await db`select * from partners where id = ${params.id}`;
  if (!rows.length) return fail("Partner tidak ditemukan", 404);
  const balance = Number(rows[0].wallet_balance);

  if (type === "debit" && amount > balance) return fail("Saldo tidak cukup", 400);
  const newBalance = type === "credit" ? balance + amount : balance - amount;

  await db`update partners set wallet_balance = ${newBalance} where id = ${params.id}`;
  const tx = (
    await db`insert into wallet_transactions (partner_id, type, amount, description)
      values (${params.id}, ${type}, ${amount}, ${description}) returning *`
  )[0];
  return ok({ wallet_balance: newBalance, transaction: tx });
}

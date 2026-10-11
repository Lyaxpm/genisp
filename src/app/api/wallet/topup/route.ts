import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql, type Sql } from "@/lib/db";
import { getOrCreateWallet } from "@/lib/wallet";
import {
  createXenditInvoice,
  createMidtransTransaction,
  createTripayTransaction,
} from "@/lib/gateways";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GATEWAYS = ["manual", "xendit", "midtrans", "tripay"];

async function getSetting(db: Sql, key: string): Promise<string> {
  const rows = await db`select value from settings where key = ${key}`;
  return (rows[0]?.value as string) ?? "";
}

// Member mengajukan topup saldo wallet.
export async function POST(req: NextRequest) {
  const s = await getSession("wallet");
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const gateway = String(body?.gateway ?? "manual");
  if (!amount || amount <= 0) return fail("Nominal topup tidak valid", 400);
  if (!GATEWAYS.includes(gateway)) return fail("Gateway tidak valid", 400);

  const db = sql();
  const wallet = await getOrCreateWallet(db, "customer", s.id);
  const externalId = `TOPUP-${wallet.id}-${Date.now()}`;
  const topup = (
    await db`insert into wallet_topups (wallet_id, amount, gateway, external_id, status)
      values (${wallet.id}, ${amount}, ${gateway}, ${externalId}, 'pending') returning *`
  )[0];

  const instruction =
    (await getSetting(db, "payment_instruction")) ||
    "Silakan transfer ke rekening resmi perusahaan, lalu hubungi CS agar topup diverifikasi.";

  if (gateway === "manual") {
    return ok({ manual: true, instruction, topup }, 201);
  }

  try {
    let result: unknown;
    if (gateway === "xendit") {
      result = await createXenditInvoice({
        externalId,
        amount,
        description: `Topup saldo ${s.name}`,
      });
    } else if (gateway === "midtrans") {
      result = await createMidtransTransaction({
        orderId: externalId,
        amount,
        customerName: s.name,
        customerEmail: s.email ?? undefined,
      });
    } else {
      result = await createTripayTransaction({
        merchantRef: externalId,
        amount,
        customerName: s.name,
        customerEmail: s.email ?? undefined,
      });
    }
    return ok({ topup, checkout: result }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return ok(
      { manual: true, instruction: `${msg}. ${instruction}`, topup },
      201
    );
  }
}

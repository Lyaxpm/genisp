import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateInvoicesForPeriod } from "@/lib/billing";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const period = String(body?.period ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) return fail("period wajib format YYYY-MM", 400);
  const db = sql();
  const created = await generateInvoicesForPeriod(db, period, s.id);
  return ok({ period, generated: created.length, invoices: created });
}

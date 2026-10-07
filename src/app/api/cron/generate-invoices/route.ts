import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { generateInvoicesForPeriod } from "@/lib/billing";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return fail("Unauthorized", 401);
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const db = sql();
  const created = await generateInvoicesForPeriod(db, period, null);
  return ok({ period, generated: created.length });
}

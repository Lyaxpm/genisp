import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const db = sql();
  const invoices = status
    ? await db`select * from invoices where customer_id = ${s.id} and status = ${status} order by id desc`
    : await db`select * from invoices where customer_id = ${s.id} order by id desc`;
  const ids = invoices.map((i) => i.id as number);
  const items = ids.length
    ? await db.unsafe(`select * from invoice_items where invoice_id = any ($1) order by id asc`, [
        ids,
      ] as never[])
    : [];
  return ok({ invoices, items });
}

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getOrCreateIncomeCategory } from "@/lib/finance";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() || "pending";
  const db = sql();
  const rows = await db`select ip.*, c.name as category_name, u.name as created_by_name
    from income_pending ip
    left join income_categories c on c.id = ip.category_id
    left join users u on u.id = ip.created_by
    where ip.status = ${status}
    order by ip.id desc`;
  return ok(rows);
}

// Staff/CS mengajukan pemasukan yang butuh approval.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!amount || amount <= 0) return fail("Nominal tidak valid", 400);
  const db = sql();
  const category_id = body?.category_id
    ? Number(body.category_id)
    : await getOrCreateIncomeCategory(db, String(body?.category ?? "Lainnya").trim() || "Lainnya");
  const row = (
    await db`insert into income_pending (date, category_id, amount, description, payment_method, status, created_by)
      values (${body?.date || new Date().toISOString().slice(0, 10)}, ${category_id}, ${amount},
        ${body?.description || null}, ${body?.payment_method || null}, 'pending', ${s.id})
      returning *`
  )[0];
  return ok(row, 201);
}

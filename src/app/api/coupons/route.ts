import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession("tagihan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const items = await db`select * from coupons order by id desc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession("tagihan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toUpperCase();
  if (!code) return fail("Kode kupon wajib diisi", 400);
  const db = sql();
  const dup = await db`select id from coupons where code = ${code}`;
  if (dup.length) return fail("Kode kupon sudah dipakai", 409);
  const row = (
    await db`insert into coupons (code, discount_type, discount_value, max_use, valid_until, is_active)
      values (${code}, ${body.discount_type || "percent"}, ${Number(body.discount_value) || 0},
        ${Number(body.max_use) || 1}, ${body.valid_until || null}, ${body.is_active ?? true})
      returning *`
  )[0];
  return ok(row, 201);
}

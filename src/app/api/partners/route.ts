import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession("sales");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const db = sql();
  const items = q
    ? await db`select id, name, email, phone, commission_percent, wallet_balance, is_active, created_at
        from partners where name ilike ${"%" + q + "%"} or phone ilike ${"%" + q + "%"} order by id desc`
    : await db`select id, name, email, phone, commission_percent, wallet_balance, is_active, created_at
        from partners order by id desc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession("sales");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  if (!name || !phone) return fail("Nama dan nomor HP wajib diisi", 400);
  const db = sql();
  let password_hash: string | null = null;
  if (body?.password) password_hash = await bcrypt.hash(String(body.password), 10);
  const row = (
    await db`insert into partners (name, email, phone, password_hash, commission_percent, wallet_balance, is_active)
      values (${name}, ${body?.email || null}, ${phone}, ${password_hash},
        ${Number(body?.commission_percent) || 10}, ${Number(body?.wallet_balance) || 0}, ${body?.is_active ?? true})
      returning id, name, email, phone, commission_percent, wallet_balance, is_active, created_at`
  )[0];
  return ok(row, 201);
}

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession("sales");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from sales_fees order by id asc`;
  return ok(rows);
}

export async function POST(req: NextRequest) {
  const s = await getSession("sales");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const type = String(body?.type ?? "percent");
  const value = Number(body?.value);
  if (!name) return fail("Nama fee wajib diisi", 400);
  if (!["percent", "fixed"].includes(type)) return fail("type harus percent|fixed", 400);
  if (!(value > 0)) return fail("Nilai fee tidak valid", 400);
  const db = sql();
  const row = (
    await db`insert into sales_fees (name, type, value, is_active)
      values (${name}, ${type}, ${value}, ${body?.is_active !== false}) returning *`
  )[0];
  return ok(row, 201);
}

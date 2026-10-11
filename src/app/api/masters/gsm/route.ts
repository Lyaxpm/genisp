import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function staff() {
  const s = await getSession("master");
  if (!s || s.kind !== "staff") return null;
  return s;
}

export async function GET(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const db = sql();
  const rows = q
    ? await db`select * from gsm_users
        where name ilike ${`%${q}%`} or phone ilike ${`%${q}%`} or operator ilike ${`%${q}%`}
        order by id desc limit 200`
    : await db`select * from gsm_users order by id desc limit 200`;
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  if (!b?.name?.trim() || !b?.phone?.trim()) return fail("Nama dan no HP wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into gsm_users (name, phone, operator, quota_mb)
      values (${String(b.name).trim()}, ${String(b.phone).trim()},
        ${b.operator || null}, ${Math.max(0, Number(b.quota_mb) || 0)})
      returning *`
  )[0];
  return ok(row, 201);
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function staff() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return null;
  return s;
}

export async function GET() {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from help_types order by name asc`;
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  const s = await staff();
  if (!s) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama tipe tiket wajib diisi", 400);
  const db = sql();
  try {
    const row = (
      await db`insert into help_types (name, is_active) values (${String(body.name).trim()}, ${body.is_active ?? true}) returning *`
    )[0];
    return ok(row, 201);
  } catch {
    return fail("Nama tipe sudah dipakai", 409);
  }
}

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from gsm_users where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Data GSM tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  if (!b?.name?.trim() || !b?.phone?.trim()) return fail("Nama dan no HP wajib diisi", 400);
  const db = sql();
  const rows = await db`update gsm_users set name = ${String(b.name).trim()},
    phone = ${String(b.phone).trim()}, operator = ${b.operator || null},
    quota_mb = ${Math.max(0, Number(b.quota_mb) || 0)}
    where id = ${Number(params.id)} returning *`;
  if (!rows.length) return fail("Data GSM tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from gsm_users where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Data GSM tidak ditemukan", 404);
  return ok({ deleted: true });
}

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
  const rows = await db`select * from suppliers where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Supplier tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama supplier wajib diisi", 400);
  const db = sql();
  const rows = await db`update suppliers set name = ${String(body.name).trim()},
    phone = ${body.phone || null}, email = ${body.email || null}, address = ${body.address || null}
    where id = ${Number(params.id)} returning *`;
  if (!rows.length) return fail("Supplier tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from suppliers where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Supplier tidak ditemukan", 404);
  return ok({ deleted: true });
}

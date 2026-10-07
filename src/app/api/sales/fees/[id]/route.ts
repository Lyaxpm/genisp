import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const db = sql();
  const rows = await db`select * from sales_fees where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Fee tidak ditemukan", 404);
  const cur = rows[0] as Record<string, unknown>;
  const name = String(body?.name ?? cur.name).trim();
  const type = String(body?.type ?? cur.type);
  const value = body?.value !== undefined ? Number(body.value) : Number(cur.value);
  if (!["percent", "fixed"].includes(type)) return fail("type harus percent|fixed", 400);
  if (!(value > 0)) return fail("Nilai fee tidak valid", 400);
  const isActive: boolean =
    body?.is_active !== undefined ? Boolean(body.is_active) : Boolean(cur.is_active);
  const upd = (
    await db`update sales_fees set name = ${name}, type = ${type}, value = ${value},
      is_active = ${isActive}
      where id = ${Number(params.id)} returning *`
  )[0];
  return ok(upd);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  await db`delete from sales_fees where id = ${Number(params.id)}`;
  return ok({ deleted: true });
}

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
  const rows = await db`select * from modems where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Modem tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  const db = sql();
  const rows = await db`update modems set customer_id = ${b?.customer_id || null},
    brand = ${b?.brand || null}, serial_number = ${b?.serial_number || null},
    mac_address = ${b?.mac_address || null}, notes = ${b?.notes || null}
    where id = ${Number(params.id)} returning *`;
  if (!rows.length) return fail("Modem tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from modems where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Modem tidak ditemukan", 404);
  return ok({ deleted: true });
}

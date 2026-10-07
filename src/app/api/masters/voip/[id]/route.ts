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
  const rows = await db`select * from voip_numbers where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Nomor VoIP tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  if (!b?.number?.trim()) return fail("Nomor VoIP wajib diisi", 400);
  const db = sql();
  try {
    const rows = await db`update voip_numbers set number = ${String(b.number).trim()},
      customer_id = ${b.customer_id || null}, password = ${b.password || null},
      notes = ${b.notes || null}
      where id = ${Number(params.id)} returning *`;
    if (!rows.length) return fail("Nomor VoIP tidak ditemukan", 404);
    return ok(rows[0]);
  } catch {
    return fail("Nomor VoIP sudah dipakai", 409);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from voip_numbers where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Nomor VoIP tidak ditemukan", 404);
  return ok({ deleted: true });
}

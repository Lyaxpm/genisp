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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from onu_devices where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Perangkat ONU tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  const db = sql();
  const rows = await db`update onu_devices set olt_id = ${b?.olt_id || null},
    pon = ${b?.pon || null}, onu_no = ${b?.onu_no || null},
    serial_number = ${b?.serial_number || null}, name = ${b?.name || null},
    status = ${b?.status || "unknown"}, rx_power = ${b?.rx_power || null},
    updated_at = now()
    where id = ${Number(params.id)} returning *`;
  if (!rows.length) return fail("Perangkat ONU tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from onu_devices where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Perangkat ONU tidak ditemukan", 404);
  return ok({ deleted: true });
}

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

export async function GET(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const oltId = sp.get("olt_id")?.trim() ?? "";
  const db = sql();
  const params: unknown[] = [];
  let where = "where 1=1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and (o.name ilike $${params.length} or o.serial_number ilike $${params.length} or o.onu_no ilike $${params.length})`;
  }
  if (oltId) {
    params.push(Number(oltId));
    where += ` and o.olt_id = $${params.length}`;
  }
  const rows = await db.unsafe(
    `select o.*, ol.name as olt_name from onu_devices o
     left join olts ol on ol.id = o.olt_id
     ${where} order by o.updated_at desc limit 200`,
    params as never[]
  );
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  const db = sql();
  const row = (
    await db`insert into onu_devices (olt_id, pon, onu_no, serial_number, name, status, rx_power)
      values (${b?.olt_id || null}, ${b?.pon || null}, ${b?.onu_no || null},
        ${b?.serial_number || null}, ${b?.name || null},
        ${b?.status || "unknown"}, ${b?.rx_power || null})
      returning *`
  )[0];
  return ok(row, 201);
}

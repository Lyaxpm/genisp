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
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const db = sql();
  const rows = q
    ? await db`select m.*, c.name as customer_name, c.code as customer_code from modems m
        left join customers c on c.id = m.customer_id
        where m.brand ilike ${`%${q}%`} or m.serial_number ilike ${`%${q}%`}
          or m.mac_address ilike ${`%${q}%`} or c.name ilike ${`%${q}%`}
        order by m.id desc limit 200`
    : await db`select m.*, c.name as customer_name, c.code as customer_code from modems m
        left join customers c on c.id = m.customer_id
        order by m.id desc limit 200`;
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  const db = sql();
  const row = (
    await db`insert into modems (customer_id, brand, serial_number, mac_address, notes)
      values (${b?.customer_id || null}, ${b?.brand || null}, ${b?.serial_number || null},
        ${b?.mac_address || null}, ${b?.notes || null})
      returning *`
  )[0];
  return ok(row, 201);
}

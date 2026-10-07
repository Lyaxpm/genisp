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
    ? await db`select v.*, c.name as customer_name from voip_numbers v
        left join customers c on c.id = v.customer_id
        where v.number ilike ${`%${q}%`} or c.name ilike ${`%${q}%`}
        order by v.id desc limit 200`
    : await db`select v.*, c.name as customer_name from voip_numbers v
        left join customers c on c.id = v.customer_id
        order by v.id desc limit 200`;
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = await req.json().catch(() => null);
  if (!b?.number?.trim()) return fail("Nomor VoIP wajib diisi", 400);
  const db = sql();
  try {
    const row = (
      await db`insert into voip_numbers (number, customer_id, password, notes)
        values (${String(b.number).trim()}, ${b.customer_id || null},
          ${b.password || null}, ${b.notes || null})
        returning *`
    )[0];
    return ok(row, 201);
  } catch {
    return fail("Nomor VoIP sudah dipakai", 409);
  }
}

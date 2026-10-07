import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select c.id, c.code, c.name, c.email, c.phone, c.address, c.no_ktp, c.birth_date,
      c.package_id, p.name as package_name, p.price as package_price, p.speed_down, p.speed_up,
      c.connection_type, c.status, c.due_day, c.pppoe_user, c.registered_at
    from customers c left join packages p on p.id = c.package_id where c.id = ${s.id}`;
  if (!rows.length) return fail("Data pelanggan tidak ditemukan", 404);
  return ok(rows[0]);
}

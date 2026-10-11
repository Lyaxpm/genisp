import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Data agregat untuk peta dashboard: ODC, ODP, pelanggan berkoordinat, coverage aktif.
export async function GET() {
  const s = await getSession("peta");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const [odcs, odps, customers, coverages] = await Promise.all([
    db`select id, name, address, latitude, longitude, capacity from odcs order by name asc`,
    db`select id, odc_id, name, address, latitude, longitude, capacity from odps order by name asc`,
    db`select c.id, c.code, c.name, c.phone, c.status, c.latitude, c.longitude, p.name as package_name
      from customers c left join packages p on p.id = c.package_id
      where c.latitude is not null and c.longitude is not null
      order by c.id desc limit 2000`,
    db`select id, name, description, area from coverages where is_active = true order by id asc`,
  ]);
  return ok({ odcs, odps, customers, coverages });
}

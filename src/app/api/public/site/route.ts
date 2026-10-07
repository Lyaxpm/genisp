import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = sql();
  const company = (await db`select * from company where id = 1`)[0] ?? null;
  const slides = await db`select * from slides where is_active = true order by sort_order asc, id asc`;
  const promos = await db`select * from promos where is_active = true
    and (valid_until is null or valid_until >= current_date) order by id desc`;
  const services = await db`select * from services where is_active = true order by sort_order asc, id asc`;
  const packages = await db`select id, name, category, price, speed_down, speed_up, description
    from packages where is_active = true order by price asc`;
  const coverages = await db`select id, name, description, area from coverages where is_active = true order by id asc`;
  return ok({ company, slides, promos, services, packages, coverages });
}

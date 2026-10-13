// GET /api/dashboard/quick-search?q= — pencarian global pelanggan (nama, kode, HP, email).
// Untuk shortcut pencarian di dashboard. Hanya data DB nyata, limit 20.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIMIT = 20;

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const db = sql();

  const rows = q
    ? await db`select c.id, c.code, c.name, c.phone, c.email, c.status,
        p.name as package_name
      from customers c
      left join packages p on p.id = c.package_id
      where c.name ilike ${"%" + q + "%"}
        or c.code ilike ${"%" + q + "%"}
        or c.phone ilike ${"%" + q + "%"}
        or c.email ilike ${"%" + q + "%"}
      order by c.name asc
      limit ${LIMIT}`
    : await db`select c.id, c.code, c.name, c.phone, c.email, c.status,
        p.name as package_name
      from customers c
      left join packages p on p.id = c.package_id
      order by c.created_at desc
      limit ${LIMIT}`;

  return ok({ q, items: rows });
}

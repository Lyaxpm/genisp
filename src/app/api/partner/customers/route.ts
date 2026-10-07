import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "partner") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const db = sql();
  const base = `select c.id, c.code, c.name, c.phone, c.status, p.name as package_name
    from customers c left join packages p on p.id = c.package_id where c.partner_id = ${s.id}`;
  const items = q
    ? await db.unsafe(`${base} and (c.name ilike $1 or c.code ilike $1 or c.phone ilike $1) order by c.id desc`, [
        `%${q}%`,
      ] as never[])
    : await db.unsafe(`${base} order by c.id desc`, [] as never[]);
  return ok({ items });
}

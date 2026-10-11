import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession("sistem");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();
  const totalRows = await db`select count(*)::int as total from activity_logs`;
  const items = await db`select l.*, u.name as user_name
    from activity_logs l left join users u on u.id = l.user_id
    order by l.created_at desc limit ${limit} offset ${offset}`;
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

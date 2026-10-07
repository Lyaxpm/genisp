import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/notify/log?channel=&status=&page=&limit=
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const q = req.nextUrl.searchParams;
  const channel = q.get("channel") ?? "";
  const status = q.get("status") ?? "";
  const page = Math.max(1, Number(q.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit") ?? 20) || 20));
  const offset = (page - 1) * limit;

  const db = sql();
  const rows = await db`select id, channel, recipient, status, error, sent_at, created_at
    from notifications
    where (${channel} = '' or channel = ${channel})
      and (${status} = '' or status = ${status})
    order by id desc
    limit ${limit} offset ${offset}`;
  const cnt = await db`select count(*)::int as total from notifications
    where (${channel} = '' or channel = ${channel})
      and (${status} = '' or status = ${status})`;
  return ok({ items: rows, total: cnt[0].total as number, page, limit });
}

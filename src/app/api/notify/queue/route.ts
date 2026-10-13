import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET (staff): daftar antrean notifikasi
// query: ?status=pending|processing|sent|failed&limit=50
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const status = String(req.nextUrl.searchParams.get("status") ?? "").trim();
  const limit = Math.max(1, Math.min(200, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50));
  const db = sql();

  const rows = status
    ? await db`select id, channel, recipient,
          left(message, 160) as message_preview,
          priority, scheduled_at, status, attempts, left(last_error, 200) as last_error,
          created_at, sent_at
        from notif_queue where status = ${status}
        order by priority desc, id asc limit ${limit}`
    : await db`select id, channel, recipient,
          left(message, 160) as message_preview,
          priority, scheduled_at, status, attempts, left(last_error, 200) as last_error,
          created_at, sent_at
        from notif_queue
        order by created_at desc limit ${limit}`;
  return ok(rows);
}

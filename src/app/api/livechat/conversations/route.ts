import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { newVisitorToken } from "@/lib/livechat";

export const dynamic = "force-dynamic";

// GET /api/livechat/conversations — daftar percakapan (staff saja).
// Query: ?status=open|closed (opsional), ?page=, ?limit=
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (status === "open" || status === "closed") {
    params.push(status);
    where += ` and c.status = $${params.length}`;
  }
  const totalRows = await db.unsafe(
    `select count(*)::int as total from livechat_conversations c ${where}`,
    params as never[]
  );
  params.push(limit, offset);
  const items = await db.unsafe(
    `select c.id, c.visitor_name, c.visitor_contact, c.status, c.assigned_to,
            c.created_at, c.updated_at, c.closed_at,
            (select count(*)::int from livechat_messages m where m.conversation_id = c.id) as message_count,
            (select m.message from livechat_messages m where m.conversation_id = c.id order by m.id desc limit 1) as last_message,
            u.name as assigned_name
     from livechat_conversations c
     left join users u on u.id = c.assigned_to
     ${where} order by c.updated_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

// POST /api/livechat/conversations — buat percakapan baru (publik, tanpa login).
// Body: { visitor_name?, visitor_contact? }
// Respon: { id, visitor_token } — token WAJIB disimpan klien untuk akses berikutnya.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.visitor_name ?? "").trim().slice(0, 120) || "Pengunjung";
  const contact = String(body?.visitor_contact ?? "").trim().slice(0, 120) || null;
  const token = newVisitorToken();
  const db = sql();
  const rows = (await db`insert into livechat_conversations (visitor_name, visitor_contact, visitor_token)
    values (${name}, ${contact}, ${token})
    returning id, visitor_name, status, created_at`) as unknown as { id: number }[];
  const conv = rows[0];
  return ok(
    { id: conv.id, visitor_token: token, status: "open" },
    201
  );
}

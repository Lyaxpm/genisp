import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { getConversationByToken, getMessages } from "@/lib/livechat";

export const dynamic = "force-dynamic";

function bearerToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.nextUrl.searchParams.get("token")?.trim() ?? "";
}

// GET /api/livechat/conversations/[id] — ambil percakapan + pesan.
// Akses: staff (sesi login) ATAU pengunjung dengan token percakapan.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("ID percakapan tidak valid", 400);
  const db = sql();

  const s = await getSession();
  if (s && s.kind === "staff") {
    const rows = (await db`select id, visitor_name, visitor_contact, status, assigned_to, created_at, updated_at, closed_at
      from livechat_conversations where id = ${id}`) as unknown as Record<string, unknown>[];
    const conv = rows[0];
    if (!conv) return fail("Percakapan tidak ditemukan", 404);
    return ok({ conversation: conv, messages: await getMessages(db, id) });
  }

  const conv = await getConversationByToken(db, id, bearerToken(req));
  if (!conv) return fail("Token tidak valid atau percakapan tidak ditemukan", 403);
  const { visitor_token: _t, ...safe } = conv;
  return ok({ conversation: safe, messages: await getMessages(db, id) });
}

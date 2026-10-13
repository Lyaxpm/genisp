import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import { getConversationByToken, insertMessage } from "@/lib/livechat";

export const dynamic = "force-dynamic";

function bearerToken(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.nextUrl.searchParams.get("token")?.trim() ?? "";
}

// POST /api/livechat/conversations/[id]/messages — pengunjung mengirim pesan.
// Auth: token percakapan (header Authorization: Bearer / query ?token=).
// Body: { message }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("ID percakapan tidak valid", 400);
  const db = sql();
  const conv = await getConversationByToken(db, id, bearerToken(req));
  if (!conv) return fail("Token tidak valid atau percakapan tidak ditemukan", 403);
  if (conv.status === "closed") return fail("Percakapan sudah ditutup", 409);

  const body = await req.json().catch(() => null);
  const message = String(body?.message ?? "").trim().slice(0, 4000);
  if (!message) return fail("Pesan tidak boleh kosong", 400);

  const msg = await insertMessage(db, id, "visitor", message);
  return ok(msg, 201);
}

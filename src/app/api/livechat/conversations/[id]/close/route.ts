import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { publishChatEvent } from "@/lib/livechat";

export const dynamic = "force-dynamic";

// POST /api/livechat/conversations/[id]/close — staff menutup percakapan (staff saja).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("ID percakapan tidak valid", 400);

  const db = sql();
  const rows = (await db`update livechat_conversations
    set status = 'closed', closed_at = now(), updated_at = now()
    where id = ${id} and status = 'open'
    returning id, status`) as { id: number; status: string }[];
  if (!rows[0]) return fail("Percakapan tidak ditemukan atau sudah ditutup", 404);

  publishChatEvent(id, { type: "status", data: { conversation_id: id, status: "closed" } });
  return ok({ id, status: "closed" });
}

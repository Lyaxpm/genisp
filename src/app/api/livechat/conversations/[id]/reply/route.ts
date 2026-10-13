import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { insertMessage } from "@/lib/livechat";

export const dynamic = "force-dynamic";

// POST /api/livechat/conversations/[id]/reply — staff membalas (staff saja).
// Body: { message }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail("ID percakapan tidak valid", 400);

  const db = sql();
  const rows = (await db`select id, status from livechat_conversations where id = ${id}`) as {
    id: number;
    status: string;
  }[];
  if (!rows[0]) return fail("Percakapan tidak ditemukan", 404);
  if (rows[0].status === "closed") return fail("Percakapan sudah ditutup", 409);

  const body = await req.json().catch(() => null);
  const message = String(body?.message ?? "").trim().slice(0, 4000);
  if (!message) return fail("Pesan tidak boleh kosong", 400);

  const msg = await insertMessage(db, id, "staff", message, s.name);
  return ok(msg, 201);
}

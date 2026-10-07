import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET: daftar semua template pesan
export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select key, channel, title, body, updated_at
    from message_templates order by channel, key`;
  return ok(rows);
}

// PUT: tambah / ubah template by key
export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const key = String(body?.key ?? "").trim();
  const channel = String(body?.channel ?? "whatsapp").trim();
  const title = String(body?.title ?? "");
  const text = String(body?.body ?? "");
  if (!key) return fail("key wajib diisi", 400);
  if (!["whatsapp", "sms", "email", "telegram"].includes(channel))
    return fail("channel tidak valid", 400);
  const db = sql();
  const rows = await db`insert into message_templates (key, channel, title, body, updated_at)
    values (${key}, ${channel}, ${title}, ${text}, now())
    on conflict (key) do update
      set channel = excluded.channel, title = excluded.title, body = excluded.body, updated_at = now()
    returning key, channel, title, body, updated_at`;
  return ok(rows[0]);
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CHANNELS = ["whatsapp", "telegram", "sms", "email", "fcm"];

// POST (staff): masukkan notifikasi ke antrean terjadwal berprioritas
// body: { channel, recipient, message, priority?, scheduled_at? }
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const channel = String(body?.channel ?? "").trim();
  const recipient = String(body?.recipient ?? "").trim();
  const message = String(body?.message ?? "").trim();
  const priority = Math.max(0, Math.min(100, parseInt(String(body?.priority ?? "0"), 10) || 0));
  const scheduledAtRaw = body?.scheduled_at != null ? String(body.scheduled_at).trim() : "";
  let scheduledAt: Date | null = null;
  if (scheduledAtRaw) {
    scheduledAt = new Date(scheduledAtRaw);
    if (Number.isNaN(scheduledAt.getTime())) return fail("scheduled_at tidak valid (ISO date)", 400);
  }

  if (!CHANNELS.includes(channel)) return fail(`channel tidak dikenal (${CHANNELS.join("|")})`, 400);
  if (!recipient) return fail("recipient wajib diisi", 400);
  if (!message) return fail("message wajib diisi", 400);

  const db = sql();
  const rows = await db`insert into notif_queue (channel, recipient, message, priority, scheduled_at)
    values (${channel}, ${recipient}, ${message}, ${priority}, ${scheduledAt})
    returning id, channel, recipient, priority, scheduled_at, status, created_at`;
  return ok(rows[0]);
}

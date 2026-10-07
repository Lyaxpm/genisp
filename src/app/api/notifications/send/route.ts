import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { queueNotification, trySendWhatsapp } from "@/lib/notify";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CHANNELS = ["whatsapp", "telegram", "sms", "email"];

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const channel = String(body?.channel ?? "whatsapp").trim();
  const to = String(body?.to ?? "").trim();
  const message = String(body?.message ?? "").trim();
  if (!CHANNELS.includes(channel)) return fail("Channel tidak valid", 400);
  if (!to || !message) return fail("Tujuan dan pesan wajib diisi", 400);

  if (channel === "whatsapp") {
    const r = await trySendWhatsapp(to, message);
    return ok({ id: r.id, sent: r.sent, error: r.error ?? null });
  }
  const n = await queueNotification(channel, to, message);
  return ok({ id: (n as { id: number }).id, queued: true });
}

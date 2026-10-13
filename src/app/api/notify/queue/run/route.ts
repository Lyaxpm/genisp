import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import {
  trySendWhatsapp,
  sendSms,
  sendEmail,
  sendTelegram,
  sendFcm,
} from "@/lib/notify";

export const dynamic = "force-dynamic";

const BATCH = 25;

// POST: proses antrean yang sudah jatuh tempo, prioritas tertinggi dulu.
// Proteksi CRON_SECRET (dipanggil cron tiap menit / interval pendek).
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return fail("Unauthorized", 401);

  const db = sql();
  // Klaim batch: tandai processing supaya dua runner tidak berebut
  const due = await db`update notif_queue
    set status = 'processing'
    where id in (
      select id from notif_queue
      where status = 'pending'
        and (scheduled_at is null or scheduled_at <= now())
      order by priority desc, attempts asc, id asc
      limit ${BATCH}
    )
    returning id, channel, recipient, message, attempts`;
  if (!due.length) return ok({ processed: 0 });

  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const res = await dispatch(db, String(item.channel), String(item.recipient), String(item.message));
    if (res.sent) {
      sent++;
      await db`update notif_queue
        set status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = null
        where id = ${Number(item.id)}`;
    } else {
      failed++;
      await db`update notif_queue
        set status = 'failed', attempts = attempts + 1, last_error = ${res.error ?? "gagal"}
        where id = ${Number(item.id)}`;
    }
  }
  return ok({ processed: due.length, sent, failed });
}

async function dispatch(
  db: Sql,
  channel: string,
  recipient: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    let r: { sent: boolean; error?: string };
    switch (channel) {
      case "whatsapp":
        r = await trySendWhatsapp(recipient, message);
        break;
      case "sms":
        r = await sendSms(recipient, message);
        break;
      case "email": {
        const nl = message.indexOf("\n");
        const subject = nl > 0 ? message.slice(0, nl).trim() : "Notifikasi GenISP";
        const bodyHtml = message.includes("\n")
          ? `<p>${message.slice(nl + 1).replace(/\n/g, "<br>")}</p>`
          : `<p>${message}</p>`;
        r = await sendEmail(recipient, subject, bodyHtml);
        break;
      }
      case "telegram":
        r = await sendTelegram(recipient, message);
        break;
      case "fcm": {
        const comp = (await db`select name from company where id = 1`)[0];
        r = await sendFcm(recipient, String(comp?.name ?? "GenISP"), message);
        break;
      }
      default:
        return { sent: false, error: `channel tidak dikenal: ${channel}` };
    }
    return { sent: r.sent, error: r.error };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

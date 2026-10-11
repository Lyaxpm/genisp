import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { trySendWhatsapp, sendSms, sendEmail, sendTelegram, sendFcm } from "@/lib/notify";

export const dynamic = "force-dynamic";

// POST {channel, to, message}: kirim langsung (untuk uji coba)
export async function POST(req: NextRequest) {
  const s = await getSession("notifikasi");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const channel = String(body?.channel ?? "").trim();
  const to = String(body?.to ?? "").trim();
  const message = String(body?.message ?? "").trim();
  if (!to) return fail("Tujuan (to) wajib diisi", 400);
  if (!message) return fail("Pesan wajib diisi", 400);

  let result;
  switch (channel) {
    case "whatsapp":
      result = await trySendWhatsapp(to, message);
      break;
    case "sms":
      result = await sendSms(to, message);
      break;
    case "email":
      result = await sendEmail(to, "Test Notifikasi GenISP", `<p>${message.replace(/\n/g, "<br>")}</p>`);
      break;
    case "telegram":
      result = await sendTelegram(to, message);
      break;
    case "fcm":
      result = await sendFcm(to, "Test GenISP", message);
      break;
    default:
      return fail("channel tidak dikenal (whatsapp|sms|email|telegram|fcm)", 400);
  }
  return ok(result);
}

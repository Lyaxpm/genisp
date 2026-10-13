import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getConversationByToken, subscribe } from "@/lib/livechat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/realtime/events?conversation_id=<id>&token=<visitor_token>
// Server-Sent Events: stream pesan baru satu percakapan.
//
// KNOWN LIMITATION (jujur):
// - Ini pengganti socket.io PTA. socket.io butuh koneksi stateful/long-lived
//   di satu server; itu tidak cocok untuk serverless Vercel (fungsi bisa
//   dibekukan/di-scale-out kapan saja).
// - Pub/sub di balik route ini IN-MEMORY per instance (lihat src/lib/livechat.ts):
//   pesan yang dikirim dari instance lain TIDAK diteruskan ke stream ini.
//   Di Vercel, instance dapat berganda → realtime tidak sempurna lintas instance.
// - Koneksi disarankan client untuk auto-reconnect (EventSource melakukannya
//   otomatis, `retry: 3000` di bawah).
//
// Akses: staff (sesi login) ATAU pengunjung dengan token percakapan.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = Number(sp.get("conversation_id"));
  if (!Number.isInteger(id) || id <= 0) {
    return new Response("conversation_id tidak valid", { status: 400 });
  }
  const token = sp.get("token")?.trim() ?? "";

  const s = await getSession();
  if (!s || s.kind !== "staff") {
    const db = sql();
    const conv = await getConversationByToken(db, id, token);
    if (!conv) return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let unsub: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* stream sudah ditutup */
        }
      };
      // Sarankan client reconnect 3 dtk bila koneksi putus.
      send("retry: 3000\n\n");
      send(`event: connected\ndata: ${JSON.stringify({ conversation_id: id })}\n\n`);

      unsub = subscribe(id, (ev) => {
        send(`event: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`);
      });

      // Keepalive comment agar proxy/load balancer tidak memutus koneksi diam.
      timer = setInterval(() => send(": ping\n\n"), 25000);
    },
    cancel() {
      if (timer) clearInterval(timer);
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

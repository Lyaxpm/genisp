import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { tgSendMessage } from "@/lib/telegram";
import { rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

const HELP =
  "<b>Perintah bot GenISP</b>\n\n" +
  "<code>/start &lt;kode_pelanggan&gt;</code> — tautkan akun Anda\n" +
  "<code>/whoami</code> — info pelanggan tertaut\n" +
  "<code>/tagihan</code> — tagihan belum dibayar\n" +
  "<code>/help</code> — tampilkan bantuan ini";

type TgUpdate = {
  message?: {
    chat?: { id?: number | string; username?: string };
    text?: string;
    from?: { username?: string };
  };
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!secret) return NextResponse.json({ ok: false, error: "Webhook belum dikonfigurasi" }, { status: 500 });
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (got !== secret) return NextResponse.json({ ok: false, error: "Secret tidak cocok" }, { status: 403 });

  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message;
  const chat = msg?.chat;
  const chatId = chat?.id != null ? String(chat.id) : "";
  const text = String(msg?.text ?? "").trim();
  if (!chatId || !text) return NextResponse.json({ ok: true });

  const db = sql();
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();
  const command = cmd.split("@")[0].toLowerCase();

  try {
    if (command === "/start") {
      if (!arg) {
        await tgSendMessage(chatId, `Selamat datang di bot notifikasi GenISP!\n\nTautkan akun Anda dengan:\n${HELP}`);
        return NextResponse.json({ ok: true });
      }
      const cust = (
        await db`select id, code, name from customers where lower(code) = ${arg.toLowerCase()} limit 1`
      )[0];
      if (!cust) {
        await tgSendMessage(chatId, `Kode pelanggan <code>${esc(arg)}</code> tidak ditemukan. Cek kembali kode pada struk/tagihan Anda, lalu ulangi <code>/start &lt;kode&gt;</code>.`);
        return NextResponse.json({ ok: true });
      }
      await db`insert into telegram_links (customer_id, telegram_chat_id, telegram_username)
        values (${Number(cust.id)}, ${chatId}, ${chat?.username ?? null})
        on conflict (telegram_chat_id) do update
          set customer_id = excluded.customer_id, telegram_username = excluded.telegram_username`;
      await tgSendMessage(chatId, `✅ Akun tertaut: <b>${esc(String(cust.name))}</b> (<code>${esc(String(cust.code))}</code>).\nAnda akan menerima notifikasi tagihan di sini.\n\nKetik <code>/whoami</code> untuk cek akun, <code>/tagihan</code> untuk tagihan belum dibayar.`);
      return NextResponse.json({ ok: true });
    }

    if (command === "/whoami") {
      const link = (
        await db`select c.code, c.name, c.phone, c.status
          from telegram_links t join customers c on c.id = t.customer_id
          where t.telegram_chat_id = ${chatId} limit 1`
      )[0];
      if (!link) {
        await tgSendMessage(chatId, `Akun Telegram ini belum tertaut.\nTautkan dengan: <code>/start &lt;kode_pelanggan&gt;</code>`);
        return NextResponse.json({ ok: true });
      }
      await tgSendMessage(
        chatId,
        `<b>Akun Anda</b>\nKode  : <code>${esc(String(link.code))}</code>\nNama  : <b>${esc(String(link.name))}</b>\nTelp  : ${esc(String(link.phone ?? "-"))}\nStatus: ${esc(String(link.status ?? "-"))}`
      );
      return NextResponse.json({ ok: true });
    }

    if (command === "/tagihan") {
      const link = (
        await db`select c.id, c.code, c.name from telegram_links t join customers c on c.id = t.customer_id
          where t.telegram_chat_id = ${chatId} limit 1`
      )[0];
      if (!link) {
        await tgSendMessage(chatId, `Akun Telegram ini belum tertaut.\nTautkan dengan: <code>/start &lt;kode_pelanggan&gt;</code>`);
        return NextResponse.json({ ok: true });
      }
      const rows = await db`select code, amount, due_date from invoices
        where customer_id = ${Number(link.id)} and status = 'unpaid'
        order by due_date asc limit 5`;
      if (!rows.length) {
        await tgSendMessage(chatId, `✅ Tidak ada tagihan belum dibayar untuk <b>${esc(String(link.name))}</b>.`);
        return NextResponse.json({ ok: true });
      }
      const lines = rows.map(
        (r) => `• <code>${esc(String(r.code))}</code> — <b>${esc(rupiah(r.amount))}</b> (jatuh tempo ${esc(String(r.due_date ?? "-"))})`
      );
      await tgSendMessage(chatId, `<b>Tagihan belum dibayar</b> (${esc(String(link.code))}):\n\n${lines.join("\n")}`);
      return NextResponse.json({ ok: true });
    }

    if (command === "/help") {
      await tgSendMessage(chatId, HELP);
      return NextResponse.json({ ok: true });
    }

    await tgSendMessage(chatId, `Perintah tidak dikenal.\n\n${HELP}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg2 = e instanceof Error ? e.message : String(e);
    try {
      await tgSendMessage(chatId, `Terjadi kesalahan: ${esc(msg2)}`);
    } catch {
      /* abaikan */
    }
    return NextResponse.json({ ok: true });
  }
}

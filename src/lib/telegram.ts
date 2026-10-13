// Telegram Bot API helpers (fetch langsung, token dari env TELEGRAM_BOT_TOKEN).
// Tidak menyentuh src/lib/notify.ts — pengiriman langsung dengan parse_mode HTML.

type TgOk<T> = { ok: boolean; result?: T; description?: string };

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN belum diisi");
  return t;
}

async function tgApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = (await res.json().catch(() => null)) as TgOk<T> | null;
  if (!res.ok || !j?.ok) throw new Error(j?.description ?? `Telegram API HTTP ${res.status}`);
  return j.result as T;
}

export type InlineButton = { text: string; url: string };

export async function tgSendMessage(
  chatId: string,
  text: string,
  opts: { buttons?: InlineButton[]; disablePreview?: boolean } = {}
): Promise<void> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: opts.disablePreview ?? true,
  };
  if (opts.buttons?.length) {
    payload.reply_markup = { inline_keyboard: [opts.buttons.map((b) => ({ text: b.text, url: b.url }))] };
  }
  await tgApi("sendMessage", payload);
}

export type BillNotif = {
  customerName: string;
  invoiceCode: string;
  amount: string;
  dueDate: string;
  payUrl?: string;
};

/** Notifikasi tagihan ke pelanggan tertaut, dengan tombol inline "Bayar". */
export async function sendTelegramBill(chatId: string, bill: BillNotif): Promise<void> {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text =
    `🧾 <b>Tagihan Baru</b>\n` +
    `Halo <b>${esc(bill.customerName)}</b>, tagihan internet Anda telah terbit.\n\n` +
    `No. Invoice : <code>${esc(bill.invoiceCode)}</code>\n` +
    `Nominal     : <b>${esc(bill.amount)}</b>\n` +
    `Jatuh tempo : ${esc(bill.dueDate)}`;
  const buttons = bill.payUrl ? [{ text: "💳 Bayar Sekarang", url: bill.payUrl }] : undefined;
  await tgSendMessage(chatId, text, { buttons });
}

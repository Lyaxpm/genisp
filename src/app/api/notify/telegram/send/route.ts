import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { sendTelegramBill, tgSendMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// POST (staff): kirim notifikasi tagihan ke chat Telegram pelanggan yang tertaut,
// lengkap dengan tombol inline "Bayar Sekarang".
// body: { customer_id, invoice_id? (default: tagihan belum dibayar terbaru), pay_url? }
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  if (!process.env.TELEGRAM_BOT_TOKEN) return fail("TELEGRAM_BOT_TOKEN belum diisi", 500);

  const body = await req.json().catch(() => null);
  const customerId = Number(body?.customer_id ?? 0);
  if (!customerId) return fail("customer_id wajib diisi", 400);

  const db = sql();
  const link = (
    await db`select telegram_chat_id from telegram_links where customer_id = ${customerId} limit 1`
  )[0];
  if (!link) return fail("Pelanggan belum menautkan akun Telegram (/start)", 404);

  const invoiceId = Number(body?.invoice_id ?? 0);
  const inv = invoiceId
    ? (
        await db`select i.code, i.amount, i.due_date, c.name as customer_name
          from invoices i join customers c on c.id = i.customer_id
          where i.id = ${invoiceId} and i.customer_id = ${customerId} limit 1`
      )[0]
    : (
        await db`select i.code, i.amount, i.due_date, c.name as customer_name
          from invoices i join customers c on c.id = i.customer_id
          where i.customer_id = ${customerId} and i.status = 'unpaid'
          order by i.due_date asc limit 1`
      )[0];
  if (!inv) return fail("Tidak ada tagihan untuk dikirim", 404);

  let payUrl: string | undefined = String(body?.pay_url ?? "").trim() || undefined;
  if (!payUrl && process.env.NEXT_PUBLIC_APP_URL) {
    payUrl = `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/pay/${encodeURIComponent(String(inv.code))}`;
  }

  try {
    await sendTelegramBill(String(link.telegram_chat_id), {
      customerName: String(inv.customer_name),
      invoiceCode: String(inv.code),
      amount: "Rp " + Number(inv.amount).toLocaleString("id-ID"),
      dueDate: String(inv.due_date ?? "-"),
      payUrl,
    });
    return ok({ sent: true, invoice: String(inv.code) });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502);
  }
}

// PUT (staff): kirim pesan teks bebas ke pelanggan tertaut (tanpa tombol)
export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  if (!process.env.TELEGRAM_BOT_TOKEN) return fail("TELEGRAM_BOT_TOKEN belum diisi", 500);

  const body = await req.json().catch(() => null);
  const customerId = Number(body?.customer_id ?? 0);
  const text = String(body?.text ?? "").trim();
  if (!customerId) return fail("customer_id wajib diisi", 400);
  if (!text) return fail("text wajib diisi", 400);

  const db = sql();
  const link = (
    await db`select telegram_chat_id from telegram_links where customer_id = ${customerId} limit 1`
  )[0];
  if (!link) return fail("Pelanggan belum menautkan akun Telegram (/start)", 404);

  try {
    await tgSendMessage(String(link.telegram_chat_id), text);
    return ok({ sent: true });
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e), 502);
  }
}

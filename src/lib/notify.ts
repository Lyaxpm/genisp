// Antrian notifikasi + pengirim WhatsApp / SMS / Email / Telegram / FCM.
// Semua pengiriman dicatat di tabel notifications (queued|sent|failed).
import net from "node:net";
import tls from "node:tls";
import { sql, type Sql } from "./db";
import { fillTemplate } from "./utils";

type SendResult = { sent: boolean; id: number; error?: string };

async function settingVia(db: Sql, key: string, fallback = ""): Promise<string> {
  const rows = await db`select value from settings where key = ${key} limit 1`;
  return rows.length ? String(rows[0].value ?? fallback) : fallback;
}

async function logSend(
  db: Sql,
  channel: string,
  recipient: string,
  message: string,
  sent: boolean,
  error?: string
): Promise<number> {
  const rows = await db`insert into notifications (channel, recipient, message, status, error, sent_at)
    values (${channel}, ${recipient}, ${message}, ${sent ? "sent" : "failed"}, ${error ?? null}, ${
      sent ? db`now()` : null
    })
    returning id`;
  return rows[0].id as number;
}

export async function queueNotification(channel: string, recipient: string, message: string) {
  const db = sql();
  const rows = await db`insert into notifications (channel, recipient, message)
    values (${channel}, ${recipient}, ${message})
    returning id, channel, recipient, status, created_at`;
  return rows[0];
}

export async function trySendWhatsapp(
  to: string,
  message: string
): Promise<{ sent: boolean; id: number; error?: string }> {
  const db = sql();
  const rows = await db`insert into notifications (channel, recipient, message)
    values ('whatsapp', ${to}, ${message}) returning id`;
  const id = rows[0].id as number;

  const url = process.env.WHATSAPP_API_URL;
  const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) {
    await db`update notifications set status = 'failed', error = 'WhatsApp belum dikonfigurasi' where id = ${id}`;
    return { sent: false, id, error: "WhatsApp belum dikonfigurasi" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ to, message }),
    });
    if (!res.ok) throw new Error(`WhatsApp API HTTP ${res.status}`);
    await db`update notifications set status = 'sent', sent_at = now() where id = ${id}`;
    return { sent: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db`update notifications set status = 'failed', error = ${msg} where id = ${id}`;
    return { sent: false, id, error: msg };
  }
}

/* ============================ SMS ============================ */

export async function sendSms(to: string, message: string): Promise<SendResult> {
  const db = sql();
  const enabled = await settingVia(db, "sms_enabled", "0");
  if (enabled !== "1") {
    const id = await logSend(db, "sms", to, message, false, "SMS dinonaktifkan (sms_enabled != 1)");
    return { sent: false, id, error: "SMS dinonaktifkan" };
  }
  const url = await settingVia(db, "sms_api_url", "");
  const apiKey = await settingVia(db, "sms_api_key", "");
  if (!url) {
    const id = await logSend(db, "sms", to, message, false, "sms_api_url belum diisi");
    return { sent: false, id, error: "sms_api_url belum diisi" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ api_key: apiKey || undefined, to, message }),
    });
    if (!res.ok) throw new Error(`SMS API HTTP ${res.status}`);
    const id = await logSend(db, "sms", to, message, true);
    return { sent: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const id = await logSend(db, "sms", to, message, false, msg);
    return { sent: false, id, error: msg };
  }
}

/* ============================ EMAIL (SMTP mentah, tanpa deps) ============================ */

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

function smtpExec(cfg: SmtpConfig, to: string, subject: string, html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock: net.Socket = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.createConnection({ host: cfg.host, port: cfg.port });

    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error("SMTP timeout"));
    }, 25000);

    let buf = "";
    const waiters: Array<(line: string) => void> = [];
    sock.on("data", (d: Buffer) => {
      buf += d.toString("utf8");
      let idx: number;
      while ((idx = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const w = waiters.shift();
        if (w) w(line);
      }
    });
    sock.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });

    function readResponse(): Promise<string> {
      return new Promise((res) => {
        const lines: string[] = [];
        const next = (line: string) => {
          lines.push(line);
          if (/^\d{3} /.test(line)) res(lines.join("\n"));
          else waiters.push(next);
        };
        waiters.push(next);
      });
    }

    async function cmd(c: string, expect: number[]): Promise<void> {
      sock.write(c + "\r\n");
      const r = await readResponse();
      const code = parseInt(r.slice(0, 3), 10);
      if (!expect.includes(code)) throw new Error(`SMTP "${c.split(" ")[0]}" gagal: ${r}`);
    }

    (async () => {
      const greet = await readResponse();
      if (!greet.startsWith("220")) throw new Error("SMTP greeting gagal: " + greet);
      await cmd("EHLO genisp", [250]);
      if (cfg.user) {
        await cmd("AUTH LOGIN", [334]);
        await cmd(Buffer.from(cfg.user, "utf8").toString("base64"), [334]);
        await cmd(Buffer.from(cfg.pass, "utf8").toString("base64"), [235]);
      }
      await cmd(`MAIL FROM:<${cfg.from}>`, [250]);
      await cmd(`RCPT TO:<${to}>`, [250, 251]);
      await cmd("DATA", [354]);
      const subj = "=?UTF-8?B?" + Buffer.from(subject, "utf8").toString("base64") + "?=";
      const data =
        `From: ${cfg.from}\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subj}\r\n` +
        "MIME-Version: 1.0\r\n" +
        'Content-Type: text/html; charset=utf-8\r\n' +
        "Content-Transfer-Encoding: 8bit\r\n\r\n" +
        html +
        "\r\n.\r\n";
      sock.write(data);
      const r = await readResponse();
      if (!r.startsWith("250")) throw new Error("SMTP DATA gagal: " + r);
      sock.write("QUIT\r\n");
      clearTimeout(timer);
      sock.end();
      resolve();
    })().catch((e) => {
      clearTimeout(timer);
      sock.destroy();
      reject(e);
    });
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const db = sql();
  const enabled = await settingVia(db, "email_enabled", "0");
  if (enabled !== "1") {
    const id = await logSend(db, "email", to, `${subject}\n${html}`, false, "Email dinonaktifkan");
    return { sent: false, id, error: "Email dinonaktifkan" };
  }
  const cfg: SmtpConfig = {
    host: await settingVia(db, "smtp_host", ""),
    port: Number((await settingVia(db, "smtp_port", "587")) || 587),
    secure: (await settingVia(db, "smtp_secure", "0")) === "1",
    user: await settingVia(db, "smtp_user", ""),
    pass: await settingVia(db, "smtp_pass", ""),
    from: await settingVia(db, "smtp_from", ""),
  };
  if (!cfg.host || !cfg.from) {
    const id = await logSend(db, "email", to, subject, false, "smtp_host / smtp_from belum diisi");
    return { sent: false, id, error: "Konfigurasi SMTP belum lengkap" };
  }
  try {
    await smtpExec(cfg, to, subject, html);
    const id = await logSend(db, "email", to, `${subject}\n${html}`, true);
    return { sent: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const id = await logSend(db, "email", to, `${subject}\n${html}`, false, msg);
    return { sent: false, id, error: msg };
  }
}

/* ============================ TELEGRAM ============================ */

export async function sendTelegram(chatId: string, message: string): Promise<SendResult> {
  const db = sql();
  const enabled = await settingVia(db, "telegram_enabled", "0");
  const token = process.env.TELEGRAM_BOT_TOKEN ?? (await settingVia(db, "telegram_bot_token", ""));
  if (enabled !== "1" || !token) {
    const id = await logSend(db, "telegram", chatId, message, false, "Telegram belum dikonfigurasi");
    return { sent: false, id, error: "Telegram belum dikonfigurasi" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !j?.ok) throw new Error(j?.description ?? `Telegram API HTTP ${res.status}`);
    const id = await logSend(db, "telegram", chatId, message, true);
    return { sent: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const id = await logSend(db, "telegram", chatId, message, false, msg);
    return { sent: false, id, error: msg };
  }
}

/* ============================ FCM ============================ */

export async function sendFcm(token: string, title: string, body: string): Promise<SendResult> {
  const db = sql();
  const message = `${title} — ${body}`;
  const key = process.env.FCM_SERVER_KEY ?? (await settingVia(db, "fcm_server_key", ""));
  if (!key) {
    const id = await logSend(db, "fcm", token, message, false, "FCM belum dikonfigurasi");
    return { sent: false, id, error: "FCM belum dikonfigurasi" };
  }
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `key=${key}` },
      body: JSON.stringify({ to: token, notification: { title, body } }),
    });
    if (!res.ok) throw new Error(`FCM HTTP ${res.status}`);
    const id = await logSend(db, "fcm", token, message, true);
    return { sent: true, id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const id = await logSend(db, "fcm", token, message, false, msg);
    return { sent: false, id, error: msg };
  }
}

/* ============================ NOTIFIKASI PELANGGAN ============================ */

export type NotifyKind = "bill" | "paid" | "isolir" | "reminder";

export type NotifyCustomer = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

const KIND_TEMPLATE: Record<NotifyKind, string> = {
  bill: "wa_bill",
  paid: "wa_paid",
  isolir: "wa_isolir",
  reminder: "wa_reminder",
};

const KIND_DEFAULT: Record<NotifyKind, string> = {
  bill: "Halo {nama}, tagihan internet {periode} sebesar {nominal} telah terbit. Kode: {kode}, jatuh tempo {jatuh_tempo}. - {perusahaan}",
  paid: "Terima kasih {nama}, pembayaran {kode} sebesar {nominal} telah kami terima. - {perusahaan}",
  isolir:
    "Halo {nama}, layanan internet Anda diisolir karena tagihan {kode} belum dibayar. Segera bayar untuk aktivasi kembali. - {perusahaan}",
  reminder:
    "Halo {nama}, tagihan {kode} sebesar {nominal} jatuh tempo {jatuh_tempo}. Mohon segera dibayar. - {perusahaan}",
};

/**
 * Kirim notifikasi ke pelanggan sesuai kind.
 * Template diambil dari message_templates (fallback: settings wa_* lalu default bawaan),
 * lalu dikirim via WA + SMS + Email sesuai toggle settings. Tidak pernah throw.
 */
export async function notifyCustomer(
  db: Sql,
  customer: NotifyCustomer,
  kind: NotifyKind,
  vars: Record<string, string>
): Promise<void> {
  try {
    const comp = (await db`select name from company where id = 1`)[0];
    const allVars: Record<string, string> = {
      perusahaan: String(comp?.name ?? "GenISP"),
      nama: String(customer.name ?? ""),
      ...vars,
    };

    const tplKey = KIND_TEMPLATE[kind];
    const tpl = await db`select body from message_templates where key = ${tplKey} limit 1`;
    let body = tpl.length ? String(tpl[0].body ?? "") : "";
    if (!body) body = await settingVia(db, `wa_${kind}`, "");
    if (!body) body = KIND_DEFAULT[kind];
    const message = fillTemplate(body, allVars);

    const jobs: Promise<unknown>[] = [];
    if (customer.phone) jobs.push(trySendWhatsapp(customer.phone, message).catch(() => null));

    const smsOn = await settingVia(db, "sms_enabled", "0");
    if (smsOn === "1" && customer.phone) jobs.push(sendSms(customer.phone, message).catch(() => null));

    const mailOn = await settingVia(db, "email_enabled", "0");
    if (mailOn === "1" && customer.email) {
      const etpl = await db`select title, body from message_templates where key = ${"email_" + kind} limit 1`;
      const subject = fillTemplate(String(etpl[0]?.title ?? `Notifikasi ${kind} - ${allVars.perusahaan}`), allVars);
      const ebody = fillTemplate(String(etpl[0]?.body ?? body), allVars).replace(/\n/g, "<br>");
      jobs.push(sendEmail(customer.email, subject, `<p>${ebody}</p>`).catch(() => null));
    }

    await Promise.all(jobs);
  } catch {
    /* notifikasi tidak boleh menggagalkan alur utama */
  }
}

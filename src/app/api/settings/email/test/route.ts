// Test kirim email SMTP (staff). Password diambil dari env SMTP_PASS.
// STATUS: UNTESTED-tanpa-SMTP — belum pernah dicoba kirim ke server SMTP sungguhan.
import { NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import { staff, readSettings } from "../../_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const to = String(body?.to ?? "").trim();
  if (!to || !to.includes("@")) return fail("Alamat email tujuan tidak valid", 400);

  const pass = process.env.SMTP_PASS;
  if (!pass)
    return fail(
      "SMTP_PASS belum diset di environment variable. Test email tidak bisa dijalankan tanpa password SMTP.",
      400
    );

  const db = sql();
  const cfg = await readSettings(db, [
    "email_host", "email_port", "email_secure", "email_user",
    "email_from_name", "email_from_email",
  ]);
  if (!cfg.email_host)
    return fail("SMTP host belum dikonfigurasi. Isi dulu di settings email.", 400);
  if (!cfg.email_user)
    return fail("SMTP user belum dikonfigurasi. Isi dulu di settings email.", 400);

  const port = Number(cfg.email_port || 587);
  const secure = cfg.email_secure === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host: cfg.email_host,
    port,
    secure,
    auth: { user: cfg.email_user, pass },
  });

  const fromName = cfg.email_from_name || "GenISP";
  const fromEmail = cfg.email_from_email || cfg.email_user;
  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject: "Test Email SMTP — GenISP",
      text: "Ini email percobaan dari GenISP. Konfigurasi SMTP Anda berfungsi.",
      html: "<p>Ini email percobaan dari <b>GenISP</b>. Konfigurasi SMTP Anda berfungsi.</p>",
    });
    return ok({ sent: true, messageId: info.messageId });
  } catch (e: unknown) {
    return fail(
      `Gagal mengirim email: ${(e as Error)?.message ?? "unknown error"}. Periksa host/port/user dan password SMTP (env SMTP_PASS).`,
      502
    );
  }
}

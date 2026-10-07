import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { queueNotification } from "@/lib/notify";
import { ok, fail, randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  if (!name || !phone) return fail("Nama dan nomor HP wajib diisi", 400);
  const db = sql();

  const code = "C" + randomCode(6);
  const row = (
    await db`insert into customers (code, name, email, phone, address, package_id, notes, status)
      values (${code}, ${name}, ${body?.email || null}, ${phone}, ${body?.address || null},
        ${body?.package_id ? Number(body.package_id) : null}, ${body?.notes || null}, 'pending')
      returning id, code, name, phone, status`
  )[0];

  try {
    await queueNotification(
      "whatsapp",
      phone,
      `Halo ${name}, pendaftaran layanan GenISP Anda (ID: ${code}) sudah kami terima. Tim kami akan segera menghubungi Anda. Terima kasih!`
    );
  } catch {
    /* abaikan */
  }
  return ok({ registered: true, customer: row }, 201);
}

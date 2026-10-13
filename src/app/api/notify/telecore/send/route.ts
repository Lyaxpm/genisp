import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { sendTelecoreBlast, telecoreConfigured } from "@/lib/telecore";

export const dynamic = "force-dynamic";

// POST (staff): kirim WA blast via Telecore.
// body: { message, phones?: string[] } ATAU { message, customer_ids?: number[], status?: string }
// - phones: nomor tujuan langsung
// - customer_ids / status: ambil nomor dari tabel customers
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);

  if (!telecoreConfigured()) return fail("Telecore belum dikonfigurasi (isi TELECORE_BASE_URL dan TELECORE_API_KEY)", 500);

  const body = await req.json().catch(() => null);
  const message = String(body?.message ?? "").trim();
  if (!message) return fail("message wajib diisi", 400);

  const db = sql();
  let phones: string[] = [];

  const direct = body?.phones;
  if (Array.isArray(direct) && direct.length) {
    phones = direct.map((p) => String(p).trim()).filter(Boolean);
  } else {
    const ids = Array.isArray(body?.customer_ids) ? body.customer_ids.map(Number).filter(Boolean) : [];
    const status = String(body?.status ?? "").trim();
    if (ids.length) {
      const rows = await db`select phone from customers where id = any(${ids}) and phone is not null`;
      phones = rows.map((r) => String(r.phone));
    } else if (status) {
      const rows = await db`select phone from customers where status = ${status} and phone is not null`;
      phones = rows.map((r) => String(r.phone));
    } else {
      return fail("isi phones[] atau customer_ids[] atau status", 400);
    }
  }

  if (!phones.length) return fail("Tidak ada nomor tujuan", 400);
  if (phones.length > 500) return fail("Maksimal 500 nomor per request", 400);

  const result = await sendTelecoreBlast(phones, message);
  try {
    await db`insert into activity_logs (user_id, action, detail)
      values (${s.id}, 'telecore:blast', ${`total=${result.total} sent=${result.sent} failed=${result.failed.length}`})`;
  } catch {
    /* abaikan */
  }
  return ok(result);
}

// GET (staff): status konfigurasi Telecore (tanpa membocorkan key)
export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  return ok({
    configured: telecoreConfigured(),
    base_url: process.env.TELECORE_BASE_URL ? "(terisi)" : "(kosong)",
  });
}

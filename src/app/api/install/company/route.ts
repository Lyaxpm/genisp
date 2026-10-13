import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/install/company — baca profil perusahaan + timezone
export async function GET() {
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL belum diisi", 500);
  try {
    const db = sql();
    const c = await db`select id, name, address, phone, email from company where id = 1`;
    let timezone = "Asia/Jakarta";
    try {
      const t = await db`select value from settings where key = 'timezone'`;
      if (t.length && t[0].value) timezone = t[0].value;
    } catch { /* abaikan */ }
    return ok({ company: c[0] ?? null, timezone });
  } catch (e) {
    return fail(`Gagal membaca profil perusahaan: ${(e as Error).message}`, 500);
  }
}

// POST /api/install/company — simpan profil perusahaan (upsert baris id=1)
export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL belum diisi", 500);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const address = String(body?.address ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const timezone = String(body?.timezone ?? "Asia/Jakarta").trim() || "Asia/Jakarta";

  if (!name) return fail("Nama perusahaan wajib diisi", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("Format email perusahaan tidak valid", 400);

  try {
    const db = sql();
    await db`
      insert into company (id, name, address, phone, email)
      values (1, ${name}, ${address || null}, ${phone || null}, ${email || null})
      on conflict (id) do update set
        name = excluded.name,
        address = excluded.address,
        phone = excluded.phone,
        email = excluded.email
    `;
    await db`
      insert into settings (key, value, updated_at) values ('timezone', ${timezone}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
    return ok({ saved: true });
  } catch (e) {
    return fail(`Gagal menyimpan profil perusahaan: ${(e as Error).message}`, 500);
  }
}

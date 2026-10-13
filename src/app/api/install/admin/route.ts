import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function passwordProblems(pw: string): string[] {
  const p: string[] = [];
  if (pw.length < 8) p.push("minimal 8 karakter");
  if (!/[a-z]/.test(pw)) p.push("mengandung huruf kecil");
  if (!/[A-Z]/.test(pw)) p.push("mengandung huruf besar");
  if (!/[0-9]/.test(pw)) p.push("mengandung angka");
  return p;
}

async function adminExists(): Promise<boolean> {
  const db = sql();
  try {
    const r = await db`select 1 from users where role in ('superadmin','admin') limit 1`;
    return r.length > 0;
  } catch {
    return false; // tabel belum ada (migrasi belum jalan)
  }
}

// GET /api/install/admin — apakah admin sudah ada?
export async function GET() {
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL belum diisi", 500);
  return ok({ exists: await adminExists() });
}

// POST /api/install/admin — buat admin pertama (superadmin). Ditolak bila sudah ada.
export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL belum diisi", 500);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!name) return fail("Nama wajib diisi", 400);
  if (!EMAIL_RE.test(email)) return fail("Format email tidak valid", 400);
  const pwProb = passwordProblems(password);
  if (pwProb.length) return fail(`Password lemah: ${pwProb.join(", ")}`, 400);

  const db = sql();
  try {
    const dup = await db`select id from users where lower(email) = ${email}`;
    if (dup.length) return fail("Email sudah terdaftar. Gunakan email lain.", 409);
    if (await adminExists())
      return fail("Admin sudah ada. Wizard instalasi tidak dapat membuat admin kedua.", 409);

    const hash = await bcrypt.hash(password, 10);
    const ins = await db`
      insert into users (name, email, password_hash, role, is_active)
      values (${name}, ${email}, ${hash}, 'superadmin', true)
      returning id
    `;
    return ok({ id: ins[0]?.id, email });
  } catch (e) {
    return fail(`Gagal membuat admin: ${(e as Error).message}`, 500);
  }
}

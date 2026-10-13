import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET (staff): daftar token FCM terdaftar (ringkas)
export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select id, owner_type, owner_id, created_at
    from fcm_tokens order by created_at desc limit 200`;
  return ok(rows);
}

// POST: daftarkan token FCM milik sendiri (staff atau member)
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "").trim();
  if (!token) return fail("token wajib diisi", 400);

  const db = sql();
  // Pastikan token tidak terdaftar di pemilik lain (unik global)
  await db`delete from fcm_tokens where token = ${token}`;
  const ownerType = s.kind === "staff" ? "staff" : "customer";
  const rows = await db`insert into fcm_tokens (owner_type, owner_id, token)
    values (${ownerType}, ${s.id}, ${token})
    returning id, owner_type, owner_id, created_at`;
  return ok(rows[0]);
}

// DELETE: hapus token FCM (milik sendiri, atau staff boleh hapus apa saja)
export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? req.nextUrl.searchParams.get("token") ?? "").trim();
  if (!token) return fail("token wajib diisi", 400);

  const db = sql();
  const ownerType = s.kind === "staff" ? "staff" : "customer";
  let rows;
  if (s.kind === "staff") {
    rows = await db`delete from fcm_tokens where token = ${token} returning id`;
  } else {
    rows = await db`delete from fcm_tokens where token = ${token}
      and owner_type = ${ownerType} and owner_id = ${s.id} returning id`;
  }
  return ok({ deleted: rows.length });
}

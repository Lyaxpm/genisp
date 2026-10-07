import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLES = ["superadmin", "admin", "teknisi", "cs", "sales"];

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "superadmin") return fail("Hanya superadmin", 403);
  const db = sql();
  const items = await db`select id, name, email, role, is_active, last_login_at, created_at
    from users order by id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "superadmin") return fail("Hanya superadmin", 403);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const role = String(body?.role ?? "cs");
  if (!name || !email || !password) return fail("Nama, email, dan password wajib diisi", 400);
  if (!ROLES.includes(role)) return fail("Role tidak valid", 400);
  const db = sql();
  const dup = await db`select id from users where lower(email) = ${email}`;
  if (dup.length) return fail("Email sudah dipakai", 409);
  const hash = await bcrypt.hash(password, 10);
  const row = (
    await db`insert into users (name, email, password_hash, role, is_active)
      values (${name}, ${email}, ${hash}, ${role}, ${body?.is_active ?? true})
      returning id, name, email, role, is_active, created_at`
  )[0];
  return ok(row, 201);
}

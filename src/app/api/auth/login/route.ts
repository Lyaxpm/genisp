import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { signSession, setSessionCookie } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const as = body?.as === "member" ? "member" : body?.as === "partner" ? "partner" : "staff";
  if (!email || !password) return fail("Email dan password wajib diisi", 400);

  const db = sql();

  if (as === "staff") {
    const rows = await db`select * from users where lower(email) = ${email}`;
    const u = rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash)))
      return fail("Email atau password salah", 401);
    if (!u.is_active) return fail("Akun dinonaktifkan", 403);
    await db`update users set last_login_at = now() where id = ${u.id}`;
    const token = await signSession({ id: u.id, name: u.name, email: u.email, role: u.role, kind: "staff" });
    await setSessionCookie(token);
    return ok({ user: { id: u.id, name: u.name, email: u.email, role: u.role, kind: "staff" } });
  }

  if (as === "member") {
    const rows = await db`select * from customers where lower(email) = ${email}`;
    const c = rows[0];
    if (!c || !c.password_hash || !(await bcrypt.compare(password, c.password_hash)))
      return fail("Email atau password salah", 401);
    if (c.status === "nonaktif") return fail("Akun dinonaktifkan", 403);
    const token = await signSession({ id: c.id, name: c.name, email: c.email ?? "", role: "member", kind: "member" });
    await setSessionCookie(token);
    return ok({ user: { id: c.id, name: c.name, email: c.email, role: "member", kind: "member" } });
  }

  const rows = await db`select * from partners where lower(email) = ${email}`;
  const p = rows[0];
  if (!p || !p.password_hash || !(await bcrypt.compare(password, p.password_hash)))
    return fail("Email atau password salah", 401);
  if (!p.is_active) return fail("Akun dinonaktifkan", 403);
  const token = await signSession({ id: p.id, name: p.name, email: p.email ?? "", role: "partner", kind: "partner" });
  await setSessionCookie(token);
  return ok({ user: { id: p.id, name: p.name, email: p.email, role: "partner", kind: "partner" } });
}

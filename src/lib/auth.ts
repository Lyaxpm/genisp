// Auth: JWT (jose) di httpOnly cookie + helper session.
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { sql } from "./db";
import { hasPermission } from "./permissions";
import type { MenuKey } from "./menus";

const COOKIE = "genisp_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET belum diisi");
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string; // superadmin|admin|cs|teknisi|sales  ATAU  member|partner
  kind: "staff" | "member" | "partner";
};

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function getSession(menu?: MenuKey): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!Number.isSafeInteger(payload.id) || !["staff", "member", "partner"].includes(String(payload.kind))) return null;
    const session = payload as unknown as SessionUser;
    const db = sql();
    if (session.kind === "staff") {
      const [user] = await db`select name, email, role from users where id = ${session.id} and is_active = true`;
      if (!user) return null;
      session.name = user.name;
      session.email = user.email;
      session.role = user.role;
      if (menu && !(await hasPermission(session.role, menu))) return null;
    } else if (session.kind === "member") {
      const rows = await db`select id from customers where id = ${session.id} and status <> 'nonaktif'`;
      if (!rows.length) return null;
    } else {
      const rows = await db`select id from partners where id = ${session.id} and is_active = true`;
      if (!rows.length) return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  cookies().set(COOKIE, "", { path: "/", maxAge: 0 });
}

export function can(session: SessionUser | null, ...allowed: string[]): boolean {
  if (!session) return false;
  if (session.role === "superadmin") return true;
  return allowed.includes(session.role);
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { MENU_KEYS, MENU_LABELS, STAFF_ROLES } from "@/lib/menus";

export const dynamic = "force-dynamic";

// GET: matrix { role: { menu_key: allowed } } + daftar menu & role
export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select role, menu_key, allowed from role_permissions`;
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const r of STAFF_ROLES) {
    matrix[r] = {};
    for (const k of MENU_KEYS) matrix[r][k] = true; // default: diizinkan
  }
  for (const row of rows) {
    const role = String(row.role);
    const key = String(row.menu_key);
    if (!matrix[role]) matrix[role] = {};
    matrix[role][key] = Boolean(row.allowed);
  }
  return ok({ matrix, menus: MENU_KEYS.map((k) => ({ key: k, label: MENU_LABELS[k] ?? k })), roles: [...STAFF_ROLES] });
}

// PUT {role, menu_key, allowed}: ubah satu izin (superadmin only)
export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  if (s.role !== "superadmin") return fail("Khusus superadmin", 403);
  const body = await req.json().catch(() => null);
  const role = String(body?.role ?? "").trim();
  const menuKey = String(body?.menu_key ?? "").trim();
  const allowed = Boolean(body?.allowed);
  if (!role || !(MENU_KEYS as readonly string[]).includes(menuKey))
    return fail("role / menu_key tidak valid", 400);
  const db = sql();
  await db`insert into role_permissions (role, menu_key, allowed)
    values (${role}, ${menuKey}, ${allowed})
    on conflict (role, menu_key) do update set allowed = excluded.allowed`;
  return ok({ role, menu_key: menuKey, allowed });
}

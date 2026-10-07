import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/roles/check?menu_key=xxx
// Dipakai middleware untuk enforcement RBAC di halaman /dashboard/*.
// - superadmin: selalu allowed
// - tidak ada baris di role_permissions: allowed (backward compat)
// - ada baris allowed=false: ditolak
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const menuKey = String(req.nextUrl.searchParams.get("menu_key") ?? "").trim();
  if (!menuKey) return fail("menu_key wajib diisi", 400);
  if (s.role === "superadmin") return ok({ allowed: true, checked: true });
  const db = sql();
  const rows = await db`select allowed from role_permissions
    where role = ${s.role} and menu_key = ${menuKey} limit 1`;
  if (!rows.length) return ok({ allowed: true, checked: false });
  return ok({ allowed: Boolean(rows[0].allowed), checked: true });
}

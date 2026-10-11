import { NextRequest } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { MENU_KEYS, type MenuKey } from "@/lib/menus";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const menu = req.nextUrl.searchParams.get("menu_key") ?? "";
  if (!(MENU_KEYS as readonly string[]).includes(menu)) return fail("Menu tidak valid", 400);
  return ok({ allowed: await hasPermission(s.role, menu as MenuKey), checked: true });
}

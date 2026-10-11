import { sql } from "./db";
import { MENU_KEYS, type MenuKey } from "./menus";

// Explicit database permissions override these conservative defaults.
const DEFAULTS: Record<string, readonly string[]> = {
  admin: MENU_KEYS.filter((key) => key !== "sistem"),
  cs: ["dashboard", "pelanggan", "tagihan", "konfirmasi", "tiket"],
  teknisi: ["dashboard", "pelanggan", "router", "ftth", "peta", "tiket", "genieacs"],
  sales: ["dashboard", "pelanggan"],
};

export function defaultPermission(role: string, menu: string): boolean {
  return role === "superadmin" || (DEFAULTS[role]?.includes(menu) ?? false);
}

export async function hasPermission(role: string, menu: MenuKey): Promise<boolean> {
  if (role === "superadmin") return true;
  try {
    const rows = await sql()`select allowed from role_permissions where role = ${role} and menu_key = ${menu}`;
    return rows.length ? rows[0].allowed === true : defaultPermission(role, menu);
  } catch {
    // Database failure must never widen permissions.
    return false;
  }
}

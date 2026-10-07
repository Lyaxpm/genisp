import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Daftar tipe tiket aktif untuk form publik
export async function GET() {
  const db = sql();
  const rows = await db`select id, name from help_types where is_active = true order by name asc`;
  return ok({ items: rows });
}

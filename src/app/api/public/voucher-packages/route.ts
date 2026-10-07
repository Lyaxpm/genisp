import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Daftar paket voucher hotspot aktif untuk halaman beli publik.
export async function GET() {
  const db = sql();
  const packages = await db`select id, name, price, duration_hours, profile, description
    from hotspot_packages where is_active = true order by price asc`;
  return ok({ packages });
}

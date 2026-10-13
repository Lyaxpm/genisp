import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Daftar testimoni yang disetujui (publik). Hanya nama pelanggan yang diekspos.
export async function GET() {
  const db = sql();
  const rows = await db`select t.id, t.rating, t.message, t.created_at, c.name as customer_name
    from testimonials t join customers c on c.id = t.customer_id
    where t.status = 'approved'
    order by t.created_at desc limit 50`;
  return ok({ testimonials: rows });
}

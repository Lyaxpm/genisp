import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/customers/unsync — pelanggan yang BELUM tersinkron ke router.
 *
 * Aturan: pelanggan aktif (status = 'aktif', tidak ter-soft-delete) yang
 * sudah dipasangi router (router_id tidak null) atau sudah punya user PPP
 * (pppoe_user tidak null) TETAPI router_synced_at masih null — artinya
 * POST /api/customers/[id]/router-sync belum pernah berhasil untuknya.
 * Kolom router_synced_at dibuat di migrasi 008_customer.sql.
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = `where c.deleted_at is null and c.status = 'aktif'
    and c.router_synced_at is null
    and (c.router_id is not null or c.pppoe_user is not null)`;
  if (q) {
    params.push(`%${q}%`);
    where += ` and (c.name ilike $${params.length} or c.code ilike $${params.length} or c.pppoe_user ilike $${params.length})`;
  }
  const totalRows = await db.unsafe(`select count(*)::int as total from customers c ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select c.id, c.code, c.name, c.phone, c.router_id, c.pppoe_user, c.connection_type,
       r.name as router_name, c.status, c.registered_at
     from customers c left join routers r on r.id = c.router_id
     ${where} order by c.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

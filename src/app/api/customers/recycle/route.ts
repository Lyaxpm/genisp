import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/customers/recycle — daftar pelanggan yang ter-soft-delete (recycle bin).
// Mirip PTA customer/recycle (soft delete + restore dari UI).
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
  let where = "where c.deleted_at is not null";
  if (q) {
    params.push(`%${q}%`);
    where += ` and (c.name ilike $${params.length} or c.code ilike $${params.length} or c.phone ilike $${params.length})`;
  }
  const totalRows = await db.unsafe(`select count(*)::int as total from customers c ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select c.id, c.code, c.name, c.phone, c.address, c.status, c.deleted_at from customers c
     ${where} order by c.deleted_at desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

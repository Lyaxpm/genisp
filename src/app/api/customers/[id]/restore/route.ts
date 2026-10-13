import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// POST /api/customers/[id]/restore — kembalikan pelanggan dari recycle bin (set deleted_at = null).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`update customers set deleted_at = null, updated_at = now()
    where id = ${params.id} and deleted_at is not null returning id, code, name`;
  if (!rows.length) return fail("Pelanggan tidak ada di recycle bin", 404);
  return ok({ restored: true, ...rows[0] });
}

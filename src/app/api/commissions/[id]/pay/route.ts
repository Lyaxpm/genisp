import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Tandai komisi sudah dibayar ke sales.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from commissions where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Komisi tidak ditemukan", 404);
  if ((rows[0] as Record<string, unknown>).status === "paid") return ok({ already: true });
  const upd = (
    await db`update commissions set status = 'paid', notes = coalesce(notes,'') where id = ${Number(params.id)} returning *`
  )[0];
  return ok(upd);
}

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Tolak pengajuan pemasukan.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("keuangan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from income_pending where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Data tidak ditemukan", 404);
  if ((rows[0] as Record<string, unknown>).status !== "pending")
    return fail("Sudah diproses sebelumnya", 400);
  const upd = (
    await db`update income_pending set status = 'rejected', reviewed_by = ${s.id}, reviewed_at = now()
      where id = ${Number(params.id)} returning *`
  )[0];
  return ok(upd);
}

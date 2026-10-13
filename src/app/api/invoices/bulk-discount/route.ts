import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Terapkan diskon massal ke beberapa invoice dalam satu transaksi DB.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number).filter((n: number) => n > 0) : [];
  const discount = Number(body?.discount ?? 0);
  if (!ids.length) return fail("ids[] tidak boleh kosong", 400);
  if (ids.length > 500) return fail("Maksimal 500 invoice per batch", 400);
  if (discount < 0) return fail("Diskon tidak valid", 400);

  const db = sql();
  const updated = await db.begin(async (tx) => {
    const rows: unknown[] = [];
    const seen = new Set<number>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const cur = await tx`select id, amount, discount, unique_code, status from invoices where id = ${id} for update`;
      if (!cur.length) throw new Error(`Invoice #${id} tidak ditemukan`);
      const inv = cur[0];
      if (inv.status === "paid") throw new Error(`Invoice #${id} sudah lunas`);
      const amount = Number(inv.amount);
      if (discount > amount) throw new Error(`Diskon melebihi nominal invoice #${id}`);
      const up = (
        await tx`update invoices
          set discount = ${discount}, unique_amount = amount + unique_code - ${discount}
          where id = ${id} returning id, discount, unique_amount`
      )[0];
      rows.push(up);
    }
    return rows;
  }).catch((e: Error) => ({ err: e.message }));

  if ("err" in (updated as object)) return fail((updated as { err: string }).err, 400);
  return ok({ updated: (updated as unknown[]).length, invoices: updated });
}

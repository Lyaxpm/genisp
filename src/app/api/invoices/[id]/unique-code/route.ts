import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Set kode unik pembayaran: amountuniq = amount + kode_unik − diskon (rumus PTA).
// Kode unik dijamin tidak dipakai invoice unpaid lain.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const body = await req.json().catch(() => ({}));
  const db = sql();
  type CodeRes = { ok: true; invoice: unknown } | { ok: false; err: string; code: number };

  const cur = await db`select * from invoices where id = ${id}`;
  if (!cur.length) return fail("Invoice tidak ditemukan", 404);
  const inv = cur[0];
  if (inv.status === "paid") return fail("Invoice sudah lunas, kode unik tidak bisa diubah", 409);

  let code = body?.unique_code !== undefined && body?.unique_code !== "" ? Number(body.unique_code) : 0;
  if (code && (code < 1 || code > 999)) return fail("Kode unik harus 1-999", 400);

  const inv2 = await db.begin(async (tx): Promise<CodeRes> => {
    // Bila tidak diberi, bangkitkan acak 1-999 yang belum dipakai invoice unpaid lain.
    if (!code) {
      const used = await tx`select unique_code from invoices where status = 'unpaid' and unique_code != 0 and id != ${id}`;
      const taken = new Set(used.map((r) => Number(r.unique_code)));
      const tries: number[] = [];
      for (let i = 0; i < 20; i++) {
        const c = 1 + Math.floor(Math.random() * 999);
        if (!taken.has(c) && !tries.includes(c)) {
          tries.push(c);
          code = c;
          break;
        }
      }
      if (!code) return { ok: false, err: "Gagal membangkitkan kode unik, coba lagi", code: 500 };
    } else {
      const dup = await tx`select id from invoices where status = 'unpaid' and unique_code = ${code} and id != ${id}`;
      if (dup.length) return { ok: false, err: `Kode unik ${code} sudah dipakai invoice unpaid lain`, code: 409 };
    }

    const amount = Number(inv.amount);
    const discount = Number(inv.discount ?? 0);
    const unique_amount = amount + code - discount;
    const up = (
      await tx`update invoices set unique_code = ${code}, unique_amount = ${unique_amount} where id = ${id} returning *`
    )[0];
    return { ok: true, invoice: up };
  });

  if (!inv2.ok) return fail(inv2.err, inv2.code);
  return ok(inv2.invoice);
}

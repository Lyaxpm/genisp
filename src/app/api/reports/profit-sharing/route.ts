import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import type { Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Basis bagi hasil: invoice lunas pada periode (batas waktu lunas).
async function compute(db: Sql, period: string) {
  const base = (
    await db`select coalesce(sum(amount),0)::float8 as total, count(*)::int as cnt
      from invoices where status = 'paid' and to_char(paid_at, 'YYYY-MM') = ${period}`
  )[0];
  const partners = await db`select id, name, phone, commission_percent, wallet_balance
    from partners where is_active order by id asc`;
  const items = partners.map((p) => {
    const pct = Number(p.commission_percent ?? 0);
    const share = Math.round(Number(base.total) * pct) / 100;
    return {
      partner_id: p.id,
      name: p.name,
      phone: p.phone,
      commission_percent: pct,
      share,
      wallet_balance: Number(p.wallet_balance ?? 0),
    };
  });
  return {
    period,
    base_total: Number(base.total),
    base_count: base.cnt as number,
    total_shared: items.reduce((a, i) => a + i.share, 0),
    items,
  };
}

// GET ?period=YYYY-MM → simulasi bagi hasil per partner (tidak menyimpan).
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const period = req.nextUrl.searchParams.get("period") ?? "";
  if (!/^\d{4}-\d{2}$/.test(period)) return fail("period (YYYY-MM) wajib diisi", 400);
  const db = sql();
  const calc = await compute(db, period);
  const existing = await db`select id, created_at from profit_sharing_runs where period = ${period}`;
  return ok({ ...calc, already_recorded: existing.length > 0, recorded_at: existing[0]?.created_at ?? null });
}

// POST {period} → hitung & catat: kredit wallet partner + wallet_transactions, sekali per periode.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const period = String(body?.period ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(period)) return fail("period (YYYY-MM) wajib diisi", 400);
  const db = sql();
  type ShareRes = { ok: true; calc: unknown } | { ok: false; err: string; code: number };

  const res: ShareRes = await db.begin(async (tx): Promise<ShareRes> => {
    const dup = await tx`select id from profit_sharing_runs where period = ${period}`;
    if (dup.length) return { ok: false, err: `Bagi hasil periode ${period} sudah dicatat`, code: 409 };
    const calc = await compute(tx as unknown as Sql, period);
    if (!calc.items.length) return { ok: false, err: "Tidak ada partner aktif", code: 400 };

    for (const it of calc.items) {
      if (it.share <= 0) continue;
      await tx`update partners set wallet_balance = wallet_balance + ${it.share} where id = ${it.partner_id}`;
      await tx`insert into wallet_transactions (partner_id, type, amount, description)
        values (${it.partner_id}, 'credit', ${it.share}, ${`Bagi hasil periode ${period} (${it.commission_percent}%)`})`;
    }
    await tx`insert into profit_sharing_runs (period, total_base, total_shared, details, created_by)
      values (${period}, ${calc.base_total}, ${calc.total_shared}, ${JSON.stringify(calc.items)}, ${s.id})`;
    return { ok: true, calc };
  });

  if (!res.ok) return fail(res.err, res.code);
  return ok(res.calc, 201);
}

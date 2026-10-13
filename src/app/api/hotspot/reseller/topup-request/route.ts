import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET: admin lihat semua pengajuan (?status=), reseller lihat milik sendiri.
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return fail("Unauthorized", 401);
  const db = sql();
  const status = req.nextUrl.searchParams.get("status")?.trim() ?? "";
  if (s.kind === "staff") {
    const rows = status
      ? await db`select t.*, p.name as reseller_name, p.phone as reseller_phone
          from reseller_topups t left join partners p on p.id = t.reseller_id
          where t.status = ${status} order by t.id desc limit 100`
      : await db`select t.*, p.name as reseller_name, p.phone as reseller_phone
          from reseller_topups t left join partners p on p.id = t.reseller_id
          order by t.id desc limit 100`;
    return ok({ items: rows });
  }
  if (s.kind === "partner") {
    const rows = status
      ? await db`select * from reseller_topups where reseller_id = ${s.id} and status = ${status} order by id desc`
      : await db`select * from reseller_topups where reseller_id = ${s.id} order by id desc`;
    return ok({ items: rows });
  }
  return fail("Unauthorized", 401);
}

// POST: reseller mengajukan top up saldo (status pending). Cegah spam: tolak jika masih ada pending.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "partner") return fail("Hanya reseller yang dapat mengajukan top up", 401);
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail("Nominal top up harus lebih dari 0", 400);
  const note = body?.note?.trim() ? String(body.note).trim().slice(0, 255) : null;
  const db = sql();
  const pending = await db`select id from reseller_topups where reseller_id = ${s.id} and status = 'pending' limit 1`;
  if (pending.length) return fail("Masih ada pengajuan top up yang menunggu persetujuan admin", 400);
  const row = (
    await db`insert into reseller_topups (reseller_id, amount, status, note)
      values (${s.id}, ${amount}, 'pending', ${note}) returning *`
  )[0];
  await db`insert into activity_logs (action, detail)
    values ('reseller-topup-request', ${`request=${(row as Record<string, unknown>).id} reseller=${s.id} amount=${amount}`})`.catch(() => null);
  return ok({ request: row, message: "Pengajuan top up terkirim. Menunggu persetujuan admin." }, 201);
}

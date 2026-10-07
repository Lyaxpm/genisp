import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Tiket milik member yang sedang login (customer_id = session id)
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const db = sql();
  const params: unknown[] = [s.id];
  let where = "where t.customer_id = $1";
  if (status) {
    params.push(status);
    where += ` and t.status = $${params.length}`;
  }
  const rows = await db.unsafe(
    `select t.*, ht.name as type_name from help_tickets t
     left join help_types ht on ht.id = t.type_id
     ${where} order by t.updated_at desc`,
    params as never[]
  );
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.subject?.trim() || !body?.message?.trim())
    return fail("Subjek dan pesan wajib diisi", 400);
  const db = sql();
  const cust = (await db`select name, phone from customers where id = ${s.id}`)[0];
  if (!cust) return fail("Data pelanggan tidak ditemukan", 404);
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const [{ count }] = await db`select count(*)::int as count from help_tickets where ticket_no like ${`TIX-${ymd}-%`}`;
  const ticketNo = `TIX-${ymd}-${String((count as number) + 1).padStart(4, "0")}`;
  const row = (
    await db`insert into help_tickets (ticket_no, customer_id, name, phone, subject, type_id, message)
      values (${ticketNo}, ${s.id}, ${cust.name}, ${cust.phone},
        ${String(body.subject).trim()}, ${body.type_id || null}, ${String(body.message).trim()})
      returning *`
  )[0];
  return ok(row, 201);
}

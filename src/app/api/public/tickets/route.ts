import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Buat tiket publik (tanpa login). Jika customer_code cocok → tautkan customer_id.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  const subject = String(body?.subject ?? "").trim();
  const message = String(body?.message ?? "").trim();
  if (!name || !phone || !subject || !message)
    return fail("Nama, no HP, subjek, dan pesan wajib diisi", 400);
  const db = sql();

  let customerId: number | null = null;
  const code = String(body?.customer_code ?? "").trim();
  if (code) {
    const c = await db`select id from customers where code = ${code} or phone = ${code} limit 1`;
    if (c.length) customerId = c[0].id as number;
  }

  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const [{ count }] = await db`select count(*)::int as count from help_tickets where ticket_no like ${`TIX-${ymd}-%`}`;
  const ticketNo = `TIX-${ymd}-${String((count as number) + 1).padStart(4, "0")}`;

  const row = (
    await db`insert into help_tickets (ticket_no, customer_id, name, phone, subject, type_id, message)
      values (${ticketNo}, ${customerId}, ${name}, ${phone}, ${subject},
        ${body?.type_id || null}, ${message})
      returning ticket_no, status, created_at`
  )[0];
  return ok({ ticket_no: row.ticket_no, status: row.status }, 201);
}

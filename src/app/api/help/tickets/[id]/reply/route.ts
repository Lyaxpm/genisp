import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("tiket");
  if (!s) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.message?.trim()) return fail("Pesan balasan wajib diisi", 400);
  const db = sql();
  const ticketId = Number(params.id);

  // Member hanya boleh membalas tiket miliknya sendiri
  if (s.kind === "member") {
    const own = await db`select id from help_tickets where id = ${ticketId} and customer_id = ${s.id}`;
    if (!own.length) return fail("Tiket tidak ditemukan", 404);
  } else if (s.kind !== "staff") {
    return fail("Unauthorized", 401);
  }

  const authorType = s.kind === "staff" ? "staff" : "customer";
  const row = (
    await db`insert into help_replies (ticket_id, author_type, author_id, author_name, message)
      values (${ticketId}, ${authorType}, ${s.id}, ${s.name}, ${String(body.message).trim()})
      returning *`
  )[0];
  await db`update help_tickets set updated_at = now() where id = ${ticketId}`;
  return ok(row, 201);
}

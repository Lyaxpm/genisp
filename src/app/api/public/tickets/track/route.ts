import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Lacak tiket publik: ?no=TIX-...&phone=...
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const no = sp.get("no")?.trim() ?? "";
  const phone = sp.get("phone")?.trim() ?? "";
  if (!no || !phone) return fail("Nomor tiket dan no HP wajib diisi", 400);
  const db = sql();
  const rows = await db`select t.*, ht.name as type_name from help_tickets t
    left join help_types ht on ht.id = t.type_id
    where t.ticket_no = ${no} and t.phone = ${phone}`;
  if (!rows.length) return fail("Tiket tidak ditemukan. Periksa nomor tiket & no HP.", 404);
  const replies = await db`select author_type, author_name, message, created_at
    from help_replies where ticket_id = ${rows[0].id} order by created_at asc`;
  return ok({ ...rows[0], replies });
}

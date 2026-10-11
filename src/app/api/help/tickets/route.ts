import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SELECT = `t.*, ht.name as type_name, u.name as assigned_name,
  c.name as customer_name, c.code as customer_code`;

export async function GET(req: NextRequest) {
  const s = await getSession("tiket");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const q = sp.get("q")?.trim() ?? "";
  const db = sql();
  const params: unknown[] = [];
  let where = "where 1=1";
  if (status) {
    params.push(status);
    where += ` and t.status = $${params.length}`;
  }
  if (q) {
    params.push(`%${q}%`);
    where += ` and (t.ticket_no ilike $${params.length} or t.subject ilike $${params.length} or t.name ilike $${params.length})`;
  }
  const rows = await db.unsafe(
    `select ${SELECT} from help_tickets t
     left join help_types ht on ht.id = t.type_id
     left join users u on u.id = t.assigned_to
     left join customers c on c.id = t.customer_id
     ${where} order by t.created_at desc limit 200`,
    params as never[]
  );
  return ok({ items: rows });
}

export async function POST(req: NextRequest) {
  const s = await getSession("tiket");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.subject?.trim() || !body?.message?.trim() || !body?.name?.trim())
    return fail("Nama, subjek, dan pesan wajib diisi", 400);
  const db = sql();
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const [{ count }] = await db`select count(*)::int as count from help_tickets where ticket_no like ${`TIX-${ymd}-%`}`;
  const ticketNo = `TIX-${ymd}-${String((count as number) + 1).padStart(4, "0")}`;
  const row = (
    await db`insert into help_tickets (ticket_no, customer_id, name, phone, subject, type_id, message, priority, assigned_to)
      values (${ticketNo}, ${body.customer_id || null}, ${String(body.name).trim()},
        ${String(body.phone || "").trim()}, ${String(body.subject).trim()},
        ${body.type_id || null}, ${String(body.message).trim()},
        ${body.priority || "normal"}, ${body.assigned_to || null})
      returning *`
  )[0];
  return ok(row, 201);
}

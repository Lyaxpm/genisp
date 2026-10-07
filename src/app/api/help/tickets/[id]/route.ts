import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function staff() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return null;
  return s;
}

const SELECT = `t.*, ht.name as type_name, u.name as assigned_name,
  c.name as customer_name, c.code as customer_code`;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || (s.kind !== "staff" && s.kind !== "member")) return fail("Unauthorized", 401);
  const db = sql();
  const id = Number(params.id);
  const rows = await db.unsafe(
    `select ${SELECT} from help_tickets t
     left join help_types ht on ht.id = t.type_id
     left join users u on u.id = t.assigned_to
     left join customers c on c.id = t.customer_id
     where t.id = $1${s.kind === "member" ? " and t.customer_id = " + s.id : ""}`,
    [id] as never[]
  );
  if (!rows.length) return fail("Tiket tidak ditemukan", 404);
  const replies = await db`select * from help_replies where ticket_id = ${id} order by created_at asc`;
  return ok({ ...rows[0], replies });
}

const STATUSES = ["open", "process", "done", "closed"];
const PRIORITIES = ["low", "normal", "high"];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const db = sql();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (body?.status && STATUSES.includes(body.status)) {
    vals.push(body.status);
    sets.push(`status = $${vals.length}`);
  }
  if (body?.priority && PRIORITIES.includes(body.priority)) {
    vals.push(body.priority);
    sets.push(`priority = $${vals.length}`);
  }
  if (body?.assigned_to !== undefined) {
    vals.push(body.assigned_to || null);
    sets.push(`assigned_to = $${vals.length}`);
  }
  if (!sets.length) return fail("Tidak ada perubahan", 400);
  sets.push("updated_at = now()");
  vals.push(Number(params.id));
  const rows = await db.unsafe(
    `update help_tickets set ${sets.join(", ")} where id = $${vals.length} returning *`,
    vals as never[]
  );
  if (!rows.length) return fail("Tiket tidak ditemukan", 404);
  return ok(rows[0]);
}

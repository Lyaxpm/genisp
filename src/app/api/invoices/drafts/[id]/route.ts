import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getDraft(id: number) {
  const db = sql();
  const rows = await db`select d.*, c.name as customer_name, c.code as customer_code
    from invoice_drafts d join customers c on c.id = d.customer_id where d.id = ${id}`;
  if (!rows.length) return null;
  const items = await db`select * from invoice_draft_items where draft_id = ${id} order by id asc`;
  return { ...rows[0], items };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const d = await getDraft(Number(params.id));
  if (!d) return fail("Draft tidak ditemukan", 404);
  return ok(d);
}

// Ubah draft (hanya yang masih berstatus draft).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const db = sql();
  const cur = await db`select * from invoice_drafts where id = ${id}`;
  if (!cur.length) return fail("Draft tidak ditemukan", 404);
  if (cur[0].status !== "draft") return fail("Draft yang sudah final/batal tidak bisa diubah", 409);

  const amount = body?.amount !== undefined ? Number(body.amount) : Number(cur[0].amount);
  const discount = body?.discount !== undefined ? Number(body.discount) : Number(cur[0].discount);
  const period = body?.period !== undefined ? String(body.period).trim() : cur[0].period;
  if (!/^\d{4}-\d{2}$/.test(period)) return fail("Format period harus YYYY-MM", 400);
  if (!amount || amount <= 0) return fail("Nominal draft tidak valid", 400);
  if (discount < 0 || discount > amount) return fail("Diskon tidak valid", 400);

  const d = await db.begin(async (tx) => {
    const up = (
      await tx`update invoice_drafts set amount = ${amount}, discount = ${discount}, period = ${period},
        due_date = ${body?.due_date !== undefined ? body.due_date || null : cur[0].due_date},
        notes = ${body?.notes !== undefined ? body.notes || null : cur[0].notes},
        updated_at = now() where id = ${id} returning *`
    )[0];
    if (Array.isArray(body?.items)) {
      await tx`delete from invoice_draft_items where draft_id = ${id}`;
      for (const it of body.items) {
        const desc = String(it.description ?? "").trim();
        if (!desc) continue;
        await tx`insert into invoice_draft_items (draft_id, description, qty, price)
          values (${id}, ${desc}, ${Number(it.qty) || 1}, ${Number(it.price) || 0})`;
      }
    }
    return up;
  });
  return ok(d);
}

// Hapus draft (hanya yang masih berstatus draft).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const db = sql();
  const cur = await db`select status from invoice_drafts where id = ${id}`;
  if (!cur.length) return fail("Draft tidak ditemukan", 404);
  if (cur[0].status !== "draft") return fail("Draft yang sudah final/batal tidak bisa dihapus", 409);
  await db`delete from invoice_drafts where id = ${id}`;
  return ok({ deleted: id });
}

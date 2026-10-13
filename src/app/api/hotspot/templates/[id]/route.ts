import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_SIZES = ["A4", "A5", "80mm", "58mm"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from hotspot_voucher_templates where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Template tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const db = sql();
  const exists = await db`select id from hotspot_voucher_templates where id = ${Number(params.id)}`;
  if (!exists.length) return fail("Template tidak ditemukan", 404);
  if (!body?.name?.trim()) return fail("Nama template wajib diisi", 400);
  const paperSize = VALID_SIZES.includes(body.paper_size) ? body.paper_size : "A4";
  const active = body.is_active === true;
  const row = (
    await db`update hotspot_voucher_templates
      set name = ${String(body.name).trim()}, paper_size = ${paperSize},
          html_body = ${String(body.html_body ?? "")}, is_active = ${active}, updated_at = now()
      where id = ${Number(params.id)} returning *`
  )[0];
  if (active) {
    await db`update hotspot_voucher_templates set is_active = false where id <> ${Number(params.id)}`;
  }
  return ok(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from hotspot_voucher_templates where id = ${Number(params.id)} returning id`;
  if (!rows.length) return fail("Template tidak ditemukan", 404);
  return ok({ deleted: true });
}

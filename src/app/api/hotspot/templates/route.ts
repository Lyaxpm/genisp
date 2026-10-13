import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_SIZES = ["A4", "A5", "80mm", "58mm"];

// Daftar template (staff). Placeholder: {{username}} {{password}} {{profile}}.
export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const items = await db`select * from hotspot_voucher_templates order by is_active desc, id desc`;
  const active = items.find((r) => (r as Record<string, unknown>).is_active) ?? null;
  return ok({ items, active });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return fail("Nama template wajib diisi", 400);
  const paperSize = VALID_SIZES.includes(body.paper_size) ? body.paper_size : "A4";
  const db = sql();
  const row = (
    await db`insert into hotspot_voucher_templates (name, paper_size, html_body, is_active, created_by)
      values (${String(body.name).trim()}, ${paperSize}, ${String(body.html_body ?? "")}, ${body.is_active === true}, ${s.id})
      returning *`
  )[0];
  // Bila dijadikan aktif, nonaktifkan yang lain.
  if (body.is_active === true) {
    await db`update hotspot_voucher_templates set is_active = false where id <> ${Number((row as Record<string, unknown>).id)}`;
  }
  return ok(row, 201);
}

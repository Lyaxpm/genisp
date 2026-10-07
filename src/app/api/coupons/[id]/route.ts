import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UPDATABLE = ["code", "discount_type", "discount_value", "max_use", "used_count", "valid_until", "is_active"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from coupons where id = ${params.id}`;
  if (!rows.length) return fail("Data tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Body tidak valid", 400);
  const db = sql();
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const k of UPDATABLE) {
    if (body[k] !== undefined) {
      let v: unknown = body[k];
      if (["discount_value", "max_use", "used_count"].includes(k)) v = Number(v) || 0;
      if (k === "code") v = String(v).trim().toUpperCase();
      if (v === "") v = null;
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
  }
  if (!sets.length) return fail("Tidak ada perubahan", 400);
  values.push(params.id);
  const rows = await db.unsafe(
    `update coupons set ${sets.join(", ")} where id = $${values.length} returning *`,
    values as never[]
  );
  if (!rows.length) return fail("Data tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from coupons where id = ${params.id} returning id`;
  if (!rows.length) return fail("Data tidak ditemukan", 404);
  return ok({ deleted: true });
}

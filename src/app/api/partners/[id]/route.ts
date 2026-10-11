import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UPDATABLE = ["name", "email", "phone", "commission_percent", "is_active"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("sales");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select id, name, email, phone, commission_percent, wallet_balance, is_active, created_at
    from partners where id = ${params.id}`;
  if (!rows.length) return fail("Partner tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("sales");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Body tidak valid", 400);
  const db = sql();
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const k of UPDATABLE) {
    if (body[k] !== undefined) {
      let v: unknown = body[k];
      if (k === "commission_percent") v = Number(v) || 0;
      if (v === "") v = null;
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
  }
  if (body.password) {
    values.push(await bcrypt.hash(String(body.password), 10));
    sets.push(`password_hash = $${values.length}`);
  }
  if (!sets.length) return fail("Tidak ada perubahan", 400);
  values.push(params.id);
  const rows = await db.unsafe(
    `update partners set ${sets.join(", ")} where id = $${values.length}
     returning id, name, email, phone, commission_percent, wallet_balance, is_active, created_at`,
    values as never[]
  );
  if (!rows.length) return fail("Partner tidak ditemukan", 404);
  return ok(rows[0]);
}

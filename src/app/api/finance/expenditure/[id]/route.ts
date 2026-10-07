import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function resolveCategory(db: Sql, name: unknown): Promise<number> {
  const n = String(name ?? "").trim();
  const rows = await db`select id from expenditure_categories where name = ${n}`;
  if (rows.length) return rows[0].id as number;
  const ins = await db`insert into expenditure_categories (name) values (${n}) returning id`;
  return ins[0].id as number;
}

const UPDATABLE = ["date", "amount", "description", "payment_method"];

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
      if (k === "amount") v = Number(v) || 0;
      if (v === "") v = null;
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
  }
  if (body.category_id !== undefined) {
    values.push(body.category_id ? Number(body.category_id) : null);
    sets.push(`category_id = $${values.length}`);
  } else if (body.category !== undefined) {
    values.push(body.category ? await resolveCategory(db, body.category) : null);
    sets.push(`category_id = $${values.length}`);
  }
  if (!sets.length) return fail("Tidak ada perubahan", 400);
  values.push(params.id);
  const rows = await db.unsafe(
    `update expenditures set ${sets.join(", ")} where id = $${values.length} returning *`,
    values as never[]
  );
  if (!rows.length) return fail("Data tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from expenditures where id = ${params.id} returning id`;
  if (!rows.length) return fail("Data tidak ditemukan", 404);
  return ok({ deleted: true });
}

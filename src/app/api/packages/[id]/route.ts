import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UPDATABLE = ["name", "category", "price", "speed_down", "speed_up", "description", "is_active"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from packages where id = ${params.id}`;
  if (!rows.length) return fail("Paket tidak ditemukan", 404);
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
      if (k === "price") v = Number(v) || 0;
      if (v === "") v = null;
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
  }
  if (!sets.length) return fail("Tidak ada perubahan", 400);
  values.push(params.id);
  const rows = await db.unsafe(
    `update packages set ${sets.join(", ")} where id = $${values.length} returning *`,
    values as never[]
  );
  if (!rows.length) return fail("Paket tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const used = await db`select id from customers where package_id = ${params.id} limit 1`;
  if (used.length) return fail("Paket masih dipakai pelanggan, tidak bisa dihapus", 409);
  const rows = await db`delete from packages where id = ${params.id} returning id`;
  if (!rows.length) return fail("Paket tidak ditemukan", 404);
  return ok({ deleted: true });
}

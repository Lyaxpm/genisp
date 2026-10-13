import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from receipt_templates where id = ${Number(params.id)}`;
  if (!rows.length) return fail("Template tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const body = await req.json().catch(() => null);
  const db = sql();
  const cur = await db`select * from receipt_templates where id = ${id}`;
  if (!cur.length) return fail("Template tidak ditemukan", 404);

  const name = body?.name !== undefined ? String(body.name).trim() : cur[0].name;
  const body_html = body?.body_html !== undefined ? String(body.body_html) : cur[0].body_html;
  const kind = body?.kind !== undefined ? String(body.kind).trim() : cur[0].kind;
  if (!name) return fail("name tidak boleh kosong", 400);
  if (!["thermal", "a4"].includes(kind)) return fail("kind harus thermal|a4", 400);

  const t = await db.begin(async (tx) => {
    if (body?.is_default) {
      await tx`update receipt_templates set is_default = false where kind = ${kind} and id != ${id}`;
    }
    return (
      await tx`update receipt_templates set name = ${name}, body_html = ${body_html}, kind = ${kind},
        is_default = ${body?.is_default !== undefined ? !!body.is_default : cur[0].is_default}
        where id = ${id} returning *`
    )[0];
  });
  return ok(t);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  const db = sql();
  const rows = await db`delete from receipt_templates where id = ${id} returning id`;
  if (!rows.length) return fail("Template tidak ditemukan", 404);
  return ok({ deleted: id });
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UPDATABLE = ["name", "host", "api_port", "username", "location", "is_active"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select id, name, host, api_port, username, location, is_active, last_seen_at, created_at
    from routers where id = ${params.id}`;
  if (!rows.length) return fail("Router tidak ditemukan", 404);
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
      if (k === "api_port") v = Number(v) || 8728;
      if (v === "") v = null;
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
  }
  if (body.password !== undefined) {
    values.push(body.password ? Buffer.from(String(body.password)).toString("base64") : "");
    sets.push(`password_enc = $${values.length}`);
  }
  if (!sets.length) return fail("Tidak ada perubahan", 400);
  values.push(params.id);
  const rows = await db.unsafe(
    `update routers set ${sets.join(", ")} where id = $${values.length}
     returning id, name, host, api_port, username, location, is_active, last_seen_at, created_at`,
    values as never[]
  );
  if (!rows.length) return fail("Router tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from routers where id = ${params.id} returning id`;
  if (!rows.length) return fail("Router tidak ditemukan", 404);
  return ok({ deleted: true });
}

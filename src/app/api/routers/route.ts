import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession("router");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const items = await db`select id, name, host, api_port, username, location, is_active, last_seen_at, created_at
    from routers order by id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession("router");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body?.name?.trim() || !body?.host?.trim() || !body?.username?.trim())
    return fail("Nama, host, dan username wajib diisi", 400);
  const db = sql();
  const row = (
    await db`insert into routers (name, host, api_port, username, password_enc, location, is_active)
      values (${String(body.name).trim()}, ${String(body.host).trim()},
        ${Number(body.api_port) || 8728}, ${String(body.username).trim()},
        ${body.password ? Buffer.from(String(body.password)).toString("base64") : ""},
        ${body.location || null}, ${body.is_active ?? true})
      returning id, name, host, api_port, username, location, is_active, last_seen_at, created_at`
  )[0];
  return ok(row, 201);
}

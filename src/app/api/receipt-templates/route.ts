import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const kind = req.nextUrl.searchParams.get("kind")?.trim() ?? "";
  const db = sql();
  const items = kind
    ? await db`select * from receipt_templates where kind = ${kind} order by is_default desc, id asc`
    : await db`select * from receipt_templates order by is_default desc, id asc`;
  return ok({ items });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const body_html = String(body?.body_html ?? "").trim();
  const kind = String(body?.kind ?? "thermal").trim();
  if (!name || !body_html) return fail("name dan body_html wajib diisi", 400);
  if (!["thermal", "a4"].includes(kind)) return fail("kind harus thermal|a4", 400);

  const db = sql();
  const t = await db.begin(async (tx) => {
    if (body?.is_default) {
      await tx`update receipt_templates set is_default = false where kind = ${kind}`;
    }
    return (
      await tx`insert into receipt_templates (name, kind, body_html, is_default, created_by)
        values (${name}, ${kind}, ${body_html}, ${!!body?.is_default}, ${s.id}) returning *`
    )[0];
  });
  return ok(t, 201);
}

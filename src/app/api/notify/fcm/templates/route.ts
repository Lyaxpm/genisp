import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NAMES = ["bill", "paid", "isolir", "reminder"];

// GET (staff): daftar template FCM
export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select id, name, title, body, created_at, updated_at
    from fcm_templates order by name`;
  return ok(rows);
}

// POST (staff): tambah / ubah template by name
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim().toLowerCase();
  const title = String(body?.title ?? "").trim();
  const text = String(body?.body ?? "").trim();
  if (!name) return fail("name wajib diisi", 400);
  if (!title) return fail("title wajib diisi", 400);
  if (!text) return fail("body wajib diisi", 400);

  const db = sql();
  const rows = await db`insert into fcm_templates (name, title, body, updated_at)
    values (${name}, ${title}, ${text}, now())
    on conflict (name) do update
      set title = excluded.title, body = excluded.body, updated_at = now()
    returning id, name, title, body, created_at, updated_at`;
  return ok(rows[0]);
}

// DELETE (staff): hapus template custom (template bawaan tidak boleh dihapus)
export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const name = String(req.nextUrl.searchParams.get("name") ?? "").trim().toLowerCase();
  if (!name) return fail("name wajib diisi", 400);
  if (NAMES.includes(name)) return fail("Template bawaan tidak boleh dihapus", 400);

  const db = sql();
  const rows = await db`delete from fcm_templates where name = ${name} returning id`;
  return ok({ deleted: rows.length });
}

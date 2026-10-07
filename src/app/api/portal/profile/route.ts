import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UPDATABLE = ["name", "email", "phone", "address", "no_ktp", "birth_date"];

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Body tidak valid", 400);
  const db = sql();
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const k of UPDATABLE) {
    if (body[k] !== undefined) {
      let v: unknown = body[k];
      if (v === "") v = null;
      values.push(v);
      sets.push(`${k} = $${values.length}`);
    }
  }
  if (!sets.length) return fail("Tidak ada perubahan", 400);
  values.push(s.id);
  const rows = await db.unsafe(
    `update customers set ${sets.join(", ")}, updated_at = now() where id = $${values.length}
     returning id, code, name, email, phone, address, status`,
    values as never[]
  );
  if (!rows.length) return fail("Data pelanggan tidak ditemukan", 404);
  return ok(rows[0]);
}

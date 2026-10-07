import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLES = ["superadmin", "admin", "teknisi", "cs", "sales"];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.role !== "superadmin") return fail("Hanya superadmin", 403);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Body tidak valid", 400);
  const db = sql();
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const k of ["name", "email", "role", "is_active"]) {
    if (body[k] !== undefined) {
      if (k === "role" && !ROLES.includes(String(body[k]))) return fail("Role tidak valid", 400);
      values.push(body[k]);
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
    `update users set ${sets.join(", ")}, updated_at = now() where id = $${values.length}
     returning id, name, email, role, is_active, last_login_at, created_at`,
    values as never[]
  );
  if (!rows.length) return fail("User tidak ditemukan", 404);
  return ok(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.role !== "superadmin") return fail("Hanya superadmin", 403);
  if (Number(params.id) === s.id) return fail("Tidak boleh menghapus akun sendiri", 400);
  const db = sql();
  const rows = await db`delete from users where id = ${params.id} returning id`;
  if (!rows.length) return fail("User tidak ditemukan", 404);
  return ok({ deleted: true });
}

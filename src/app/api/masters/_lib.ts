// Helper CRUD generik untuk master referensi (stream S13).
// File diawali underscore → bukan route Next.js.
import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export async function staff() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return null;
  return s;
}

export type MasterDef = {
  table: string;
  label: string;
  /** kolom teks yang bisa diedit */
  fields: string[];
  /** kolom boolean yang bisa diedit */
  bools?: string[];
  /** jika true, baris is_system=true tidak boleh dihapus */
  protectSystem?: boolean;
  /** kolom pencarian untuk ?q= */
  searchFields?: string[];
  order?: string;
  required?: string[];
};

export async function masterList(def: MasterDef, req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db: Sql = sql();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const params: unknown[] = [];
  let where = "where 1=1";
  if (q && def.searchFields?.length) {
    params.push(`%${q}%`);
    const cond = def.searchFields
      .map((f) => `${f} ilike $${params.length}`)
      .join(" or ");
    where += ` and (${cond})`;
  }
  const order = def.order ?? "order by id asc";
  const rows = await db.unsafe(
    `select * from ${def.table} ${where} ${order} limit 500`,
    params as never[]
  );
  return ok({ items: rows });
}

function pick(def: MasterDef, b: Record<string, unknown> | null | undefined) {
  const data: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (b && b[f] !== undefined) data[f] = b[f] === "" ? null : b[f];
  }
  for (const f of def.bools ?? []) {
    if (b && b[f] !== undefined) data[f] = !!b[f];
  }
  return data;
}

export async function masterCreate(def: MasterDef, req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const db: Sql = sql();
  for (const f of def.required ?? []) {
    if (!b || String(b[f] ?? "").trim() === "")
      return fail(`${def.label}: field "${f}" wajib diisi`, 400);
  }
  const data = pick(def, b);
  const cols = Object.keys(data);
  if (!cols.length) return fail("Tidak ada data untuk disimpan", 400);
  try {
    const row = (
      await db.unsafe(
        `insert into ${def.table} (${cols.join(", ")})
         values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`,
        cols.map((c) => data[c]) as never[]
      )
    )[0];
    return ok(row, 201);
  } catch (e: unknown) {
    if (String((e as Error)?.message ?? "").includes("unique"))
      return fail(`${def.label} dengan nama tersebut sudah ada`, 409);
    throw e;
  }
}

export async function masterGet(def: MasterDef, id: string) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db: Sql = sql();
  const rows = await db.unsafe(`select * from ${def.table} where id = $1`, [
    Number(id),
  ] as never[]);
  if (!rows.length) return fail(`${def.label} tidak ditemukan`, 404);
  return ok(rows[0]);
}

export async function masterUpdate(def: MasterDef, req: NextRequest, id: string) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const db: Sql = sql();
  const data = pick(def, b);
  const cols = Object.keys(data);
  if (!cols.length) return fail("Tidak ada data untuk diubah", 400);
  try {
    const rows = await db.unsafe(
      `update ${def.table} set ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")},
       updated_at = now() where id = $${cols.length + 1} returning *`,
      [...cols.map((c) => data[c]), Number(id)] as never[]
    );
    if (!rows.length) return fail(`${def.label} tidak ditemukan`, 404);
    return ok(rows[0]);
  } catch (e: unknown) {
    if (String((e as Error)?.message ?? "").includes("unique"))
      return fail(`${def.label} dengan nama tersebut sudah ada`, 409);
    throw e;
  }
}

export async function masterDelete(def: MasterDef, id: string) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db: Sql = sql();
  if (def.protectSystem) {
    const cur = await db.unsafe(`select is_system from ${def.table} where id = $1`, [
      Number(id),
    ] as never[]);
    if (!cur.length) return fail(`${def.label} tidak ditemukan`, 404);
    if (cur[0].is_system)
      return fail(`${def.label} bawaan sistem tidak boleh dihapus`, 400);
  }
  const rows = await db.unsafe(
    `delete from ${def.table} where id = $1 returning id`,
    [Number(id)] as never[]
  );
  if (!rows.length) return fail(`${def.label} tidak ditemukan`, 404);
  return ok({ deleted: true });
}

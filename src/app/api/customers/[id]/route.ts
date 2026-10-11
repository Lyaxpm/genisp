import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));

const UPDATABLE = [
  "code", "name", "email", "phone", "address", "no_ktp", "birth_date", "package_id", "router_id",
  "pppoe_user", "pppoe_pass", "connection_type", "status", "due_day", "auto_isolir",
  "latitude", "longitude", "odp_id", "odp_port", "mac_address", "sales_id", "partner_id", "notes",
];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("pelanggan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select c.*, p.name as package_name from customers c
    left join packages p on p.id = c.package_id where c.id = ${params.id}`;
  if (!rows.length) return fail("Pelanggan tidak ditemukan", 404);
  const { password_hash, ...rest } = rows[0] as Record<string, unknown>;
  void password_hash;
  return ok(rest);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("pelanggan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Body tidak valid", 400);
  const db = sql();

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const k of UPDATABLE) {
    if (body[k] !== undefined) {
      let v: unknown = body[k];
      if (["package_id", "router_id", "odp_id", "odp_port", "sales_id", "partner_id", "due_day"].includes(k))
        v = num(v);
      if (["latitude", "longitude"].includes(k)) v = num(v);
      if (v === "") v = null;
      values.push(v);
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
    `update customers set ${sets.join(", ")}, updated_at = now() where id = $${values.length} returning *`,
    values as never[]
  );
  if (!rows.length) return fail("Pelanggan tidak ditemukan", 404);
  const { password_hash: _hash, ...customer } = rows[0];
  return ok(customer);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("pelanggan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`delete from customers where id = ${params.id} returning id`;
  if (!rows.length) return fail("Pelanggan tidak ditemukan", 404);
  return ok({ deleted: true });
}

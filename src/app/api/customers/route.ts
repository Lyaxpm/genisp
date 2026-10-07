import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail, randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and (c.name ilike $${params.length} or c.code ilike $${params.length} or c.phone ilike $${params.length})`;
  }
  if (status) {
    params.push(status);
    where += ` and c.status = $${params.length}`;
  }
  const totalRows = await db.unsafe(`select count(*)::int as total from customers c ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select c.*, p.name as package_name from customers c left join packages p on p.id = c.package_id
     ${where} order by c.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const phone = String(body?.phone ?? "").trim();
  if (!name || !phone) return fail("Nama dan nomor HP wajib diisi", 400);

  const db = sql();
  let code = String(body?.code ?? "").trim().toUpperCase();
  if (!code) code = "C" + randomCode(6);
  const exists = await db`select id from customers where code = ${code}`;
  if (exists.length) return fail("Kode pelanggan sudah dipakai", 409);

  let password_hash: string | null = null;
  if (body?.password) password_hash = await bcrypt.hash(String(body.password), 10);

  const row = (
    await db`insert into customers
      (code, name, email, phone, password_hash, address, no_ktp, birth_date, package_id, router_id,
       pppoe_user, pppoe_pass, connection_type, status, due_day, auto_isolir, latitude, longitude,
       odp_id, odp_port, mac_address, sales_id, partner_id, notes, created_by)
      values (${code}, ${name}, ${body?.email || null}, ${phone}, ${password_hash},
        ${body?.address || null}, ${body?.no_ktp || null}, ${body?.birth_date || null},
        ${num(body?.package_id)}, ${num(body?.router_id)}, ${body?.pppoe_user || null}, ${body?.pppoe_pass || null},
        ${body?.connection_type || "pppoe"}, ${body?.status || "pending"},
        ${num(body?.due_day) ?? 10}, ${body?.auto_isolir ?? true},
        ${num(body?.latitude)}, ${num(body?.longitude)}, ${num(body?.odp_id)}, ${num(body?.odp_port)},
        ${body?.mac_address || null}, ${num(body?.sales_id)}, ${num(body?.partner_id)},
        ${body?.notes || null}, ${s.id})
      returning *`
  )[0];
  return ok(row, 201);
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail, randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ImportRow = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  package_id?: number | string | null;
  status?: string;
};

// POST {rows: [...]} — import pelanggan massal, lewati phone yang sudah ada.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const rows = (body?.rows ?? []) as ImportRow[];
  if (!Array.isArray(rows) || !rows.length) return fail("rows kosong", 400);
  if (rows.length > 2000) return fail("Maksimal 2000 baris per import", 400);

  const db = sql();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const name = String(r.name ?? "").trim();
    const phone = String(r.phone ?? "").trim();
    if (!name || !phone) {
      skipped++;
      continue;
    }
    try {
      const exists = await db`select id from customers where phone = ${phone} limit 1`;
      if (exists.length) {
        skipped++;
        continue;
      }
      let code = "C" + randomCode(6);
      for (let i = 0; i < 5; i++) {
        const c = await db`select id from customers where code = ${code} limit 1`;
        if (!c.length) break;
        code = "C" + randomCode(6);
      }
      const pkgId = r.package_id ? Number(r.package_id) || null : null;
      const status = ["aktif", "pending", "isolir", "nonaktif"].includes(String(r.status ?? ""))
        ? String(r.status)
        : "aktif";
      await db`insert into customers (code, name, phone, email, address, package_id, status, created_by)
        values (${code}, ${name}, ${phone}, ${String(r.email ?? "").trim() || null},
          ${String(r.address ?? "").trim() || null}, ${pkgId}, ${status}, ${s.id})`;
      inserted++;
    } catch (e) {
      skipped++;
      if (errors.length < 10) errors.push(`${phone}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return ok({ inserted, skipped, errors });
}

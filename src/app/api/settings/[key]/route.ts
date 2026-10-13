// Hapus satu key settings (staff). Dipakai halaman Pengaturan (custom key).
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import { staff } from "../_lib";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { key: string } }
) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const key = decodeURIComponent(params.key ?? "").trim();
  if (!key) return fail("Key tidak valid", 400);
  const db = sql();
  const rows = await db`delete from settings where key = ${key} returning key`;
  if (!rows.length) return fail(`Key "${key}" tidak ditemukan`, 404);
  return ok({ deleted: true, key });
}

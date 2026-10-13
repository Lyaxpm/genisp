import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

// DELETE /api/customers/[id]/purge — hapus PERMANEN pelanggan dari recycle bin.
// Wajib konfirmasi: body { "confirm": true }.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body || body.confirm !== true)
    return fail("Hapus permanen wajib dikonfirmasi: kirim body { \"confirm\": true }", 400);
  const db = sql();
  const rows = await db`select id, deleted_at from customers where id = ${params.id}`;
  if (!rows.length) return fail("Pelanggan tidak ditemukan", 404);
  if (!rows[0].deleted_at)
    return fail("Pelanggan masih aktif — hapus (soft delete) dulu sebelum purge", 400);

  // Bersihkan folder dokumen lokal milik pelanggan ini
  const docDir = path.join(uploadsDir(), "customer-documents", String(params.id));
  try {
    await fs.rm(docDir, { recursive: true, force: true });
  } catch {
    // abaikan: folder mungkin tidak ada
  }

  await db`delete from customers where id = ${params.id}`;
  return ok({ purged: true });
}

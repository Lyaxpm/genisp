import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

function storedPath(customerId: string, docId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(uploadsDir(), "customer-documents", customerId, `${docId}_${safe}`);
}

async function findDoc(customerId: string, docId: string) {
  const db = sql();
  const rows = await db`select d.*, c.deleted_at from customer_documents d
    join customers c on c.id = d.customer_id
    where d.id = ${docId} and d.customer_id = ${customerId}`;
  if (!rows.length || rows[0].deleted_at) return null;
  return rows[0] as Record<string, unknown>;
}

// DELETE /api/customers/[id]/documents/[docId] — hapus dokumen (file + record)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const doc = await findDoc(params.id, params.docId);
  if (!doc) return fail("Dokumen tidak ditemukan", 404);
  try {
    await fs.unlink(storedPath(params.id, params.docId, doc.file_name as string));
  } catch {
    // abaikan: file mungkin sudah hilang
  }
  const db = sql();
  await db`delete from customer_documents where id = ${params.docId}`;
  return ok({ deleted: true });
}

// PUT /api/customers/[id]/documents/[docId] — ubah keterangan (remark)
export async function PUT(req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const doc = await findDoc(params.id, params.docId);
  if (!doc) return fail("Dokumen tidak ditemukan", 404);
  const body = await req.json().catch(() => null);
  const remark: string | null = body?.remark === undefined ? (doc.remark as string | null) : String(body.remark ?? "").trim() || null;
  const db = sql();
  const rows = await db`update customer_documents set remark = ${remark}
    where id = ${params.docId}
    returning id, customer_id, file_name, file_url, file_type, file_size, remark, uploaded_at`;
  return ok(rows[0]);
}

// GET /api/customers/[id]/documents/[docId] — metadata dokumen
export async function GET(_req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const doc = await findDoc(params.id, params.docId);
  if (!doc) return fail("Dokumen tidak ditemukan", 404);
  const { deleted_at: _drop, ...rest } = doc;
  return NextResponse.json({ ok: true, data: rest });
}

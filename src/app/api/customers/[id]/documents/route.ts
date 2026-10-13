import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Dokumen pelanggan — analog PTA customer/adddoc & customer/doc/*.
// Penyimpanan: file lokal (repo ini belum memakai Supabase Storage), direktori
// bisa dioverride lewat env UPLOADS_DIR (lihat juga [docId]/route.ts).
function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

// Aturan validasi mengikuti PTA Customer::adddoc
const ALLOWED_EXT = new Set(["gif", "jpg", "jpeg", "png", "pdf", "doc", "docx", "xls", "xlsx"]);
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const MIME_BY_EXT: Record<string, string> = {
  gif: "image/gif",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

async function assertCustomer(db: ReturnType<typeof sql>, customerId: string) {
  const rows = await db`select id from customers where id = ${customerId} and deleted_at is null`;
  return rows.length > 0;
}

// GET /api/customers/[id]/documents — daftar dokumen
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  if (!(await assertCustomer(db, params.id))) return fail("Pelanggan tidak ditemukan", 404);
  const docs = await db`select id, customer_id, file_name, file_url, file_type, file_size,
    remark, uploaded_at from customer_documents where customer_id = ${params.id}
    order by uploaded_at desc`;
  return ok({ items: docs });
}

// POST /api/customers/[id]/documents — upload (multipart/form-data: file, remark)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  if (!(await assertCustomer(db, params.id))) return fail("Pelanggan tidak ditemukan", 404);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Body harus multipart/form-data", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("File wajib diunggah", 400);
  if (file.size > MAX_SIZE) return fail("Ukuran file maksimal 20 MB", 400);

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return fail(`Tipe file tidak diizinkan (${ext}). Izin: gif,jpg,jpeg,png,pdf,doc,docx,xls,xlsx`, 400);

  const dir = path.join(uploadsDir(), "customer-documents", String(params.id));
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    return fail("Gagal menyiapkan direktori penyimpanan", 500);
  }

  const remark = String(form.get("remark") ?? "").trim() || null;
  const row = (
    await db`insert into customer_documents (customer_id, file_name, file_type, file_size, remark, uploaded_by)
      values (${params.id}, ${safeFileName(file.name)}, ${file.type || MIME_BY_EXT[ext]}, ${file.size}, ${remark}, ${s.id})
      returning id`
  )[0];

  const stored = `${row.id}_${safeFileName(file.name)}`;
  const filePath = path.join(dir, stored);
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buf);
  } catch {
    await db`delete from customer_documents where id = ${row.id}`;
    return fail("Gagal menyimpan file", 500);
  }

  const fileUrl = `/api/customers/${params.id}/documents/${row.id}/file`;
  await db`update customer_documents set file_url = ${fileUrl} where id = ${row.id}`;

  const doc = (
    await db`select id, customer_id, file_name, file_url, file_type, file_size, remark, uploaded_at
      from customer_documents where id = ${row.id}`
  )[0];
  return ok(doc, 201);
}

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

// GET /api/customers/[id]/documents/[docId]/file — unduh file dokumen
export async function GET(_req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select d.file_name, d.file_type from customer_documents d
    join customers c on c.id = d.customer_id
    where d.id = ${params.docId} and d.customer_id = ${params.id} and c.deleted_at is null`;
  if (!rows.length) return fail("Dokumen tidak ditemukan", 404);
  const doc = rows[0] as Record<string, unknown>;
  const safe = String(doc.file_name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(uploadsDir(), "customer-documents", params.id, `${params.docId}_${safe}`);
  let buf: Buffer;
  try {
    buf = await fs.readFile(filePath);
  } catch {
    return fail("File tidak ditemukan di penyimpanan", 404);
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": String(doc.file_type || "application/octet-stream"),
      "Content-Disposition": `attachment; filename="${String(doc.file_name).replace(/"/g, "")}"`,
      "Content-Length": String(buf.length),
    },
  });
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID = ["pending", "aktif", "isolir", "nonaktif"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const status = String(body?.status ?? "").trim();
  if (!VALID.includes(status)) return fail("Status tidak valid (pending|aktif|isolir|nonaktif)", 400);
  const db = sql();
  const rows = await db`update customers set status = ${status}, updated_at = now()
    where id = ${params.id} returning id, code, name, status`;
  if (!rows.length) return fail("Pelanggan tidak ditemukan", 404);
  return ok(rows[0]);
}

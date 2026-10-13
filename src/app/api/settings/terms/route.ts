// Terms & Privacy Policy (staff). Disimpan di tabel settings:
// terms_text (Syarat & Ketentuan) dan privacy_policy_text (Kebijakan Privasi).
// Versi publik: GET /api/public/terms.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import { staff, readSettings, writeSettings } from "../_lib";

export const dynamic = "force-dynamic";

const KEYS = ["terms_text", "privacy_policy_text"];

export async function GET() {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  return ok(await readSettings(db, KEYS));
}

export async function PUT(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Body tidak valid", 400);
  const db = sql();
  const pairs: Record<string, string> = {};
  for (const k of KEYS) {
    if (body[k] !== undefined) pairs[k] = String(body[k] ?? "");
  }
  if (!Object.keys(pairs).length) return fail("Tidak ada data untuk disimpan", 400);
  await writeSettings(db, pairs);
  return ok({ saved: true });
}

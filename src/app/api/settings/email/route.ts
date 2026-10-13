// Settings SMTP email (staff). Password SMTP WAJIB via env SMTP_PASS —
// tidak pernah disimpan di DB dan tidak pernah dikembalikan API.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import {
  staff, readSettings, writeSettings, assertNoSecrets, toBool,
} from "../_lib";

export const dynamic = "force-dynamic";

const KEYS = [
  "email_enabled",
  "email_host",
  "email_port",
  "email_secure",
  "email_user",
  "email_from_name",
  "email_from_email",
  "email_notify_payment",
  "email_notify_invoice",
  "email_notify_verify",
  "email_notify_forgot",
];

const BOOLEANS = new Set([
  "email_enabled",
  "email_secure",
  "email_notify_payment",
  "email_notify_invoice",
  "email_notify_verify",
  "email_notify_forgot",
]);

export async function GET() {
  if (!(await staff())) return fail("Unauthorized", 401);
  const db = sql();
  const cfg = await readSettings(db, KEYS);
  return ok({
    ...cfg,
    // Secret tidak pernah dikembalikan — hanya status keterisian dari env.
    password_set: !!process.env.SMTP_PASS,
  });
}

export async function PUT(req: NextRequest) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Body tidak valid", 400);
  const bad = assertNoSecrets(body, "Settings email");
  if (bad) return bad;
  const db = sql();
  const pairs: Record<string, string> = {};
  for (const k of KEYS) {
    if (body[k] !== undefined)
      pairs[k] = BOOLEANS.has(k) ? toBool(body[k]) : String(body[k] ?? "");
  }
  if (!Object.keys(pairs).length) return fail("Tidak ada config untuk disimpan", 400);
  await writeSettings(db, pairs);
  return ok({ saved: true, password_set: !!process.env.SMTP_PASS });
}

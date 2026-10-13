// Terms & Privacy Policy versi PUBLIK (tanpa login).
import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";
import { readSettings } from "../../settings/_lib";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = sql();
  const cfg = await readSettings(db, ["terms_text", "privacy_policy_text"]);
  return ok({
    terms: cfg.terms_text,
    privacy_policy: cfg.privacy_policy_text,
  });
}

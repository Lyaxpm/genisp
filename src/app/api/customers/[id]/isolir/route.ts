import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isolirCustomer } from "@/lib/mikrotik-actions";
import { resolveIsolirModeForCustomer } from "@/lib/isolir-modes";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Isolir pelanggan: baca mode (override pelanggan > global > default disable),
// jalankan aksi mode yang sesuai di router (best-effort) + set status DB.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("pelanggan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const mode = await resolveIsolirModeForCustomer(db, Number(params.id));
  const res = await isolirCustomer(db, Number(params.id), mode);
  if (!res.ok) return fail(res.detail, 404);
  return ok({ ...res, isolir_mode: mode });
}

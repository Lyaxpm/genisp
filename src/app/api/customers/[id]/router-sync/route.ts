import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { routerSyncCustomer } from "@/lib/mikrotik-actions";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Sinkron user pelanggan ke router (buat PPP secret / hotspot user bila belum ada).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("pelanggan");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const mode = body?.mode === "hotspot" || body?.mode === "pppoe" ? body.mode : undefined;
  const db = sql();
  const res = await routerSyncCustomer(db, Number(params.id), mode);
  if (!res.ok && res.router === "skipped") return fail(res.detail, 400);
  if (!res.ok) return fail(res.detail, 502);
  return ok(res);
}

// GET /api/dashboard/live — kerangka status live perangkat.
// Mengembalikan data NYATA dari DB: daftar router (MikroTik) dan OLT beserta
// last_status/last_checked_at (dari migrasi S2 / 006_queue.sql).
// - status perangkat: "online" | "offline" | "unknown" (apa adanya dari DB).
// - bila belum ada router/OLT terkonfigurasi → respons jujur "belum terkonfigurasi",
//   BUKAN data palsu.
// Endpoint ini TIDAK melakukan probe ke layanan eksternal; kolom last_status diisi
// oleh proses test-koneksi / job queue yang menulis ke tabel yang sama.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();

  const routers = await db`select id, name, host, api_port, location, is_active,
      last_status, last_checked_at, last_seen_at
    from routers order by name asc`;
  const olts = await db`select id, name, brand, host, location, is_active,
      last_status, last_checked_at
    from olts order by name asc`;

  const mapDevice = (r: Record<string, unknown>) => ({
    id: r.id,
    name: r.name,
    host: r.host,
    location: r.location,
    is_active: r.is_active,
    // Status apa adanya dari DB; "unknown" bila belum pernah dicek.
    status:
      r.last_status === "online" || r.last_status === "offline"
        ? r.last_status
        : "unknown",
    last_checked_at: r.last_checked_at,
  });

  const routerItems = routers.map(mapDevice);
  const oltItems = olts.map(mapDevice);

  return ok({
    routers: {
      configured: routerItems.length > 0,
      note: routerItems.length > 0 ? null : "Belum ada router terkonfigurasi",
      items: routerItems,
    },
    olts: {
      configured: oltItems.length > 0,
      note: oltItems.length > 0 ? null : "Belum ada OLT terkonfigurasi",
      items: oltItems,
    },
  });
}

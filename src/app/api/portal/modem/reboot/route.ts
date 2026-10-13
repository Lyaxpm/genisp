import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/utils";
import {
  requireMemberService,
  connectOwnRouter,
  logMemberActivity,
} from "@/lib/portal-service";

export const dynamic = "force-dynamic";

// Reboot perangkat milik member via RouterOS.
// HANYA diizinkan bila router yang terpasang ditandai is_cpe=true
// (CPE milik satu pelanggan). Router NAS bersama TIDAK boleh di-reboot.
// Bagian RouterOS: UNTESTED-live.
export async function POST(req: NextRequest) {
  const r = await requireMemberService(req);
  if ("error" in r) return r.error;
  const { db, cust, ip } = r.ctx;

  if (cust.status !== "aktif")
    return fail("Layanan Anda tidak aktif; reboot hanya untuk layanan aktif", 409);
  if (!cust.router_id || !cust.r_host)
    return fail("Layanan belum dipasangkan router", 400);
  if (cust.r_is_cpe !== true) {
    await logMemberActivity(db, cust, "portal:modem-reboot", "ditolak: router bukan CPE milik pelanggan", ip);
    return fail(
      "Reboot tidak tersedia: router yang terpasang adalah perangkat jaringan bersama, bukan modem milik Anda.",
      409
    );
  }

  try {
    const conn = await connectOwnRouter(cust);
    try {
      const res = await conn.talk(["/system/reboot"]);
      if (!res.ok) throw new Error("perintah ditolak router");
      await logMemberActivity(db, cust, "portal:modem-reboot", "perintah reboot dikirim ke CPE", ip);
      return ok({ rebooted: true, note: "Perintah reboot dikirim. Modem akan menyala kembali ±1-2 menit." });
    } finally {
      conn.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logMemberActivity(db, cust, "portal:modem-reboot", `gagal: ${msg}`, ip);
    return fail(`Reboot gagal: ${msg}`, 502);
  }
}

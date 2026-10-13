import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/utils";
import {
  requireMemberService,
  connectOwnRouter,
  ownLoginName,
  logMemberActivity,
} from "@/lib/portal-service";
import {
  findId,
  pppSecretDisable,
  pppSecretEnable,
  pppActiveRemove,
  hotspotUserAdd,
  hotspotUserRemove,
  hotspotActiveRemove,
  rowsToObjects,
} from "@/lib/routeros";

export const dynamic = "force-dynamic";

// Self-reset koneksi oleh member pemilik layanan aktif.
// - PPPoE   : kick sesi aktif + disable/enable secret (paksa re-auth).
// - Hotspot : kick sesi + hapus lalu buat ulang user dengan kredensial yang sama.
// - FO/standalone : coba refresh DHCP lease berdasarkan MAC; bila tidak didukung, jujur.
// Bagian RouterOS: UNTESTED-live (belum pernah diuji ke perangkat nyata).
export async function POST(req: NextRequest) {
  const r = await requireMemberService(req);
  if ("error" in r) return r.error;
  const { db, cust, ip } = r.ctx;

  if (cust.status !== "aktif")
    return fail("Layanan Anda tidak aktif; reset mandiri hanya untuk layanan aktif", 409);

  const type = String(cust.connection_type || "pppoe");
  const name = ownLoginName(cust);
  if (!name) {
    await logMemberActivity(db, cust, "portal:self-reset", "gagal: username koneksi belum diisi", ip);
    return fail("Username koneksi belum diisi, hubungi admin", 400);
  }

  try {
    const conn = await connectOwnRouter(cust);
    try {
      if (type === "hotspot") {
        await hotspotActiveRemove(conn, name);
        const pass = String(cust.pppoe_pass || name);
        const existed = await findId(conn, "/ip/hotspot/user", "name", name);
        if (existed) await hotspotUserRemove(conn, name);
        await hotspotUserAdd(conn, { name, password: pass, comment: `genisp:${cust.code}` });
        await logMemberActivity(db, cust, "portal:self-reset", "reset hotspot: user dibuat ulang + sesi dikick", ip);
        return ok({ reset: true, type, note: "Kredensial hotspot dibuat ulang. Silakan login kembali." });
      }
      if (type === "fo") {
        // Standalone/static: paksa renew dengan menghapus DHCP lease berdasarkan MAC.
        const mac = String(cust.mac_address || "").trim().toUpperCase();
        if (!mac) {
          await logMemberActivity(db, cust, "portal:self-reset", "reset fo dilewati: mac_address kosong", ip);
          return ok({
            reset: false,
            type,
            note: "Reset otomatis tidak didukung untuk koneksi ini (MAC belum tercatat). Hubungi teknisi.",
          });
        }
        const found = await conn.talk(["/ip/dhcp-server/lease/print", `?mac-address=${mac}`]);
        const lease = rowsToObjects(found.data)[0];
        if (lease && lease[".id"]) {
          const del = await conn.talk(["/ip/dhcp-server/lease/remove", `=.id=${lease[".id"]}`]);
          if (!del.ok) throw new Error("gagal menghapus DHCP lease");
          await logMemberActivity(db, cust, "portal:self-reset", "reset fo: dhcp lease dihapus (paksa renew)", ip);
          return ok({ reset: true, type, note: "DHCP lease diperbarui. Perangkat akan mendapat IP baru." });
        }
        await logMemberActivity(db, cust, "portal:self-reset", "reset fo dilewati: lease DHCP tidak ditemukan", ip);
        return ok({
          reset: false,
          type,
          note: "Tidak ada lease DHCP aktif untuk perangkat ini; reset tidak dapat dilakukan dari portal.",
        });
      }
      // pppoe (default)
      await pppActiveRemove(conn, name);
      await pppSecretDisable(conn, name);
      await pppSecretEnable(conn, name);
      await logMemberActivity(db, cust, "portal:self-reset", "reset pppoe: secret disable+enable + sesi dikick", ip);
      return ok({ reset: true, type: "pppoe", note: "Koneksi direset. Modem akan dial ulang otomatis." });
    } finally {
      conn.close();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logMemberActivity(db, cust, "portal:self-reset", `gagal: ${msg}`, ip);
    return fail(`Reset gagal: ${msg}`, 502);
  }
}

import { NextRequest } from "next/server";
import { ok } from "@/lib/utils";
import { requireMemberService, ownLoginName } from "@/lib/portal-service";

export const dynamic = "force-dynamic";

// Info perangkat/koneksi milik member yang login (dari data service).
// Kredensial router & password koneksi TIDAK pernah diekspos ke portal.
export async function GET(req: NextRequest) {
  const r = await requireMemberService(req);
  if ("error" in r) return r.error;
  const { cust } = r.ctx;

  return ok({
    connection: {
      type: cust.connection_type,
      status: cust.status,
      login_name: ownLoginName(cust),
      mac_address: cust.mac_address,
      odp_id: cust.odp_id,
      odp_port: cust.odp_port,
    },
    package: {
      name: cust.package_name,
      speed_down: cust.speed_down,
      speed_up: cust.speed_up,
    },
    router: cust.router_id
      ? {
          id: cust.router_id,
          name: cust.r_name,
          host: cust.r_host,
          is_cpe: cust.r_is_cpe === true,
        }
      : null,
    // Integrasi TR-069/GenieACS (manajemen modem CPE) belum tersedia,
    // sehingga detail modem CPE (model, firmware, sinyal) belum dapat ditampilkan.
    cpe_synced: false,
    cpe_note: "Detail modem CPE belum tersedia: integrasi GenieACS/TR-069 belum dikonfigurasi.",
  });
}

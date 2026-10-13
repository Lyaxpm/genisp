import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/utils";
import {
  requireMemberService,
  connectOwnRouter,
  ownLoginName,
} from "@/lib/portal-service";
import { rowsToObjects } from "@/lib/routeros";

export const dynamic = "force-dynamic";

function bytes(n: string | undefined): number {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

// Statistik pemakaian layanan milik member yang login.
// Sumber utama: sesi aktif di router (byte counter real-time).
// Tidak ada tabel pemakaian historis di DB -> jujur bila data tidak tersedia.
// Bagian RouterOS: UNTESTED-live.
export async function GET(req: NextRequest) {
  const r = await requireMemberService(req);
  if ("error" in r) return r.error;
  const { cust } = r.ctx;

  if (cust.status !== "aktif")
    return fail("Layanan Anda tidak aktif", 409);

  const type = String(cust.connection_type || "pppoe");
  const name = ownLoginName(cust);

  let router: Record<string, unknown> | null = null;
  let note: string | null = null;

  if (!cust.router_id || !cust.r_host) {
    note = "Router belum dipasangkan; statistik pemakaian tidak tersedia.";
  } else {
    try {
      const conn = await connectOwnRouter(cust);
      try {
        if (type === "hotspot") {
          const found = await conn.talk(["/ip/hotspot/active/print", `?user=${name}`]);
          const sess = rowsToObjects(found.data)[0];
          if (sess) {
            router = {
              online: true,
              session_uptime: sess["uptime"] ?? null,
              bytes_in: bytes(sess["bytes-in"]),
              bytes_out: bytes(sess["bytes-out"]),
              packets_in: bytes(sess["packets-in"]),
              packets_out: bytes(sess["packets-out"]),
              ip_address: sess["address"] ?? null,
            };
          } else {
            router = { online: false };
            note = "Tidak ada sesi aktif saat ini; pemakaian bulan ini tidak tercatat di router.";
          }
        } else {
          const found = await conn.talk(["/ppp/active/print", `?name=${name}`]);
          const sess = rowsToObjects(found.data)[0];
          if (sess) {
            // /ppp/active tidak selalu punya counter; lengkapi dari queue bila ada.
            let qIn = 0;
            let qOut = 0;
            const q = await conn.talk(["/queue/simple/print", `?name=<pppoe-${name}>`]);
            const qr = rowsToObjects(q.data)[0];
            if (qr?.["bytes"]) {
              const [bi, bo] = String(qr["bytes"]).split("/").map(Number);
              qIn = Number.isFinite(bi) ? bi : 0;
              qOut = Number.isFinite(bo) ? bo : 0;
            }
            router = {
              online: true,
              session_uptime: sess["uptime"] ?? null,
              caller_id: sess["caller-id"] ?? null,
              ip_address: sess["address"] ?? null,
              bytes_in: qIn,
              bytes_out: qOut,
            };
            if (!qr) note = "Counter queue tidak tersedia; angka pemakaian sesi mungkin 0.";
          } else {
            router = { online: false };
            note = "Tidak ada sesi aktif saat ini; pemakaian bulan ini tidak tercatat di router.";
          }
        }
      } finally {
        conn.close();
      }
    } catch (e) {
      note = `Tidak dapat membaca data dari router: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  return ok({
    service: {
      code: cust.code,
      connection_type: type,
      status: cust.status,
      package_name: cust.package_name,
      speed_down: cust.speed_down,
      speed_up: cust.speed_up,
    },
    usage: {
      source: router ? "router" : "unavailable",
      ...router,
      note,
    },
  });
}

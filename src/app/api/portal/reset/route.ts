import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiCommand } from "@/lib/routeros";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Self-reset koneksi oleh member: tendang (kick) sesi aktif di MikroTik.
// Best-effort: selalu 200, laporkan apakah kick berhasil.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "member") return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const type = String(body?.type ?? "pppoe");
  if (!["pppoe", "hotspot"].includes(type)) return fail("Tipe reset tidak valid", 400);

  const db = sql();
  const cust = (
    await db`select c.pppoe_user, c.code, c.router_id,
        r.host, r.api_port, r.username, r.password_enc
      from customers c left join routers r on r.id = c.router_id
      where c.id = ${s.id}`
  )[0];
  if (!cust) return fail("Data pelanggan tidak ditemukan", 404);
  if (!cust.router_id || !cust.host) {
    return ok({ kicked: false, note: "Pelanggan belum terhubung ke router" });
  }

  const identity = String(cust.pppoe_user || cust.code || "").trim();
  if (!identity) {
    return ok({ kicked: false, note: "Username koneksi belum diisi" });
  }

  const password = cust.password_enc
    ? Buffer.from(String(cust.password_enc), "base64").toString("utf8")
    : "";

  try {
    if (type === "pppoe") {
      const found = await apiCommand(
        String(cust.host), Number(cust.api_port) || 8728,
        String(cust.username), password,
        ["/ppp/active/print", `?name=${identity}`]
      );
      const idRow = found.data[0]?.find((w) => w.startsWith("=.id="))?.slice(5);
      if (!idRow) return ok({ kicked: false, note: "Tidak ada sesi PPPoE aktif" });
      await apiCommand(
        String(cust.host), Number(cust.api_port) || 8728,
        String(cust.username), password,
        ["/ppp/active/remove", `=.id=${idRow}`]
      );
    } else {
      const found = await apiCommand(
        String(cust.host), Number(cust.api_port) || 8728,
        String(cust.username), password,
        ["/ip/hotspot/active/print", `?user=${identity}`]
      );
      const idRow = found.data[0]?.find((w) => w.startsWith("=.id="))?.slice(5);
      if (!idRow) return ok({ kicked: false, note: "Tidak ada sesi hotspot aktif" });
      await apiCommand(
        String(cust.host), Number(cust.api_port) || 8728,
        String(cust.username), password,
        ["/ip/hotspot/active/remove", `=.id=${idRow}`]
      );
    }
    return ok({ kicked: true, note: "Sesi berhasil diputus. Silakan konek ulang." });
  } catch (e) {
    return ok({
      kicked: false,
      note: `Gagal menghubungi router: ${e instanceof Error ? e.message : "unknown"}`,
    });
  }
}

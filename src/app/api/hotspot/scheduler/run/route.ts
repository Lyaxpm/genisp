import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import { connectRouter, findId, hotspotUserRemove, rowsToObjects } from "@/lib/routeros";

export const dynamic = "force-dynamic";

// Eksekutor scheduler sinkron MikroTik hotspot.
// Dipanggil cron (Bearer CRON_SECRET) sesuai interval di scheduler-config.
// Tugas: hapus hotspot user buatan GenISP (comment "voucher-genisp:*") yang uptime-nya
// sudah mencapai limit-uptime, lalu tandai baris vouchers yang cocok sebagai expired.
// UNTESTED-live: butuh router fisik untuk verifikasi.
const VOUCHER_COMMENT_PREFIX = "voucher-genisp:";

function rosDurationToSeconds(raw: string | undefined): number {
  if (!raw) return 0;
  let total = 0;
  const re = /(\d+)([wdhms])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const v = Number(m[1]);
    if (m[2] === "w") total += v * 604800;
    else if (m[2] === "d") total += v * 86400;
    else if (m[2] === "h") total += v * 3600;
    else if (m[2] === "m") total += v * 60;
    else if (m[2] === "s") total += v;
  }
  return total;
}

async function getSetting(db: Sql, key: string, fallback: string): Promise<string> {
  const rows = await db`select value from settings where key = ${key}`;
  return (rows[0]?.value as string) ?? fallback;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return fail("Unauthorized", 401);
  const db = sql();
  const enabled = (await getSetting(db, "hotspot_sched_enabled", "0")) === "1";
  const autoClean = (await getSetting(db, "hotspot_sched_auto_clean_expired", "1")) === "1";
  if (!enabled) return ok({ ran: false, reason: "scheduler nonaktif" });

  const routers = await db`select id, name, host, api_port, username, password_enc
    from routers where is_active = true and host is not null and host <> ''`;
  const results: Array<Record<string, unknown>> = [];
  let removed = 0;

  for (const r of routers) {
    const rid = Number(r.id);
    const rname = String(r.name ?? r.host);
    try {
      const conn = await connectRouter({
        id: rid,
        host: String(r.host),
        api_port: Number(r.api_port ?? 8728),
        username: String(r.username ?? ""),
        password_enc: String(r.password_enc ?? ""),
      });
      try {
        const reply = await conn.talk(["/ip/hotspot/user/print"]);
        const users = rowsToObjects(reply.data);
        const routerRemoved: string[] = [];
        for (const u of users) {
          const comment = String(u["comment"] ?? "");
          if (!comment.startsWith(VOUCHER_COMMENT_PREFIX)) continue;
          if (!autoClean) continue;
          const name = String(u["name"] ?? "");
          const limit = rosDurationToSeconds(String(u["limit-uptime"] ?? ""));
          const uptime = rosDurationToSeconds(String(u["uptime"] ?? ""));
          if (limit > 0 && uptime >= limit) {
            try {
              const id = await findId(conn, "/ip/hotspot/user", "name", name);
              if (id) {
                await hotspotUserRemove(conn, name);
                routerRemoved.push(name);
                removed++;
                // Sinkronkan status baris voucher (hanya kode, tanpa kredensial baru).
                await db`update vouchers set status = 'expired' where code = ${name} and status = 'active'`.catch(() => null);
              }
            } catch (e) {
              routerRemoved.push(`${name}:gagal (${e instanceof Error ? e.message : "?"})`);
            }
          }
        }
        results.push({ router: rname, ok: true, removed: routerRemoved });
      } finally {
        conn.close();
      }
    } catch (e) {
      results.push({ router: rname, ok: false, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  await db`insert into activity_logs (action, detail)
    values ('hotspot-scheduler', ${`expired_removed=${removed} routers=${routers.length}`})`.catch(() => null);
  return ok({ ran: true, removed, results });
}

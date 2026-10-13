// Aksi bisnis MikroTik: isolir/buka-isolir pelanggan, sinkron user, push voucher.
// Semua fungsi best-effort terhadap router (kegagalan router tidak merusak DB).
import { type Sql } from "./db";
import {
  connectRouter,
  findId,
  pppSecretAdd,
  pppSecretSet,
  hotspotUserAdd,
  hotspotUserEnable,
} from "./routeros";
import {
  isolateCustomer as isolateByMode,
  openCustomer as openByMode,
  pickIsolirMode,
  getGlobalIsolirMode,
  type IsolirMode,
  type IsolirCustomer,
} from "./isolir-modes";
import { randomCode } from "./utils";

export type ActionResult = {
  ok: boolean;
  detail: string;
  router: "ok" | "failed" | "skipped";
};

type CustomerFull = Record<string, unknown>;

async function getCustomerFull(db: Sql, customerId: number): Promise<CustomerFull | undefined> {
  const rows = await db`
    select c.*, p.name as package_name,
           r.host as r_host, r.api_port as r_port, r.username as r_user, r.password_enc as r_pass
    from customers c
    left join packages p on p.id = c.package_id
    left join routers r on r.id = c.router_id
    where c.id = ${customerId}`;
  return rows[0] as CustomerFull | undefined;
}

function routerCreds(c: CustomerFull) {
  return {
    id: Number(c.router_id),
    host: String(c.r_host),
    api_port: c.r_port ? Number(c.r_port) : 8728,
    username: String(c.r_user ?? ""),
    password_enc: (c.r_pass as string | null) ?? "",
  };
}

function loginName(c: CustomerFull): string {
  return (c.pppoe_user as string) || (c.code as string);
}

/** Isolir pelanggan: jalankan aksi mode isolir di router (best-effort) + set status DB.
 *  Mode: parameter > override pelanggan (customers.isolir_mode) > global (settings.isolir_mode) > "disable". */
export async function isolirCustomer(
  db: Sql,
  customerId: number,
  mode?: IsolirMode
): Promise<ActionResult> {
  const c = await getCustomerFull(db, customerId);
  if (!c) return { ok: false, detail: "Pelanggan tidak ditemukan", router: "skipped" };
  const m = mode ?? pickIsolirMode(c.isolir_mode, await getGlobalIsolirMode(db));
  let router: ActionResult["router"] = "skipped";
  let rosNote = "tidak ada router terpasang";
  if (c.router_id && c.r_host) {
    try {
      const res = await isolateByMode(routerCreds(c), c as unknown as IsolirCustomer, m);
      router = "ok";
      rosNote = res.detail;
      if (m === "profile" && res.prevProfile !== undefined) {
        await db`update customers set isolir_prev_profile = ${res.prevProfile}, updated_at = now() where id = ${customerId}`;
      }
    } catch (e) {
      router = "failed";
      rosNote = `gagal di router: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }
  await db`update customers set status = 'isolir', updated_at = now() where id = ${customerId}`;
  return { ok: true, detail: `Pelanggan diisolir (mode ${m}). ${rosNote}.`, router };
}

/** Buka isolir pelanggan: jalankan aksi buka mode isolir di router (best-effort) + set status DB.
 *  Mode: parameter > override pelanggan (customers.isolir_mode) > global (settings.isolir_mode) > "disable". */
export async function openCustomer(
  db: Sql,
  customerId: number,
  mode?: IsolirMode
): Promise<ActionResult> {
  const c = await getCustomerFull(db, customerId);
  if (!c) return { ok: false, detail: "Pelanggan tidak ditemukan", router: "skipped" };
  const m = mode ?? pickIsolirMode(c.isolir_mode, await getGlobalIsolirMode(db));
  let router: ActionResult["router"] = "skipped";
  let rosNote = "tidak ada router terpasang";
  if (c.router_id && c.r_host) {
    try {
      const res = await openByMode(routerCreds(c), c as unknown as IsolirCustomer, m);
      router = "ok";
      rosNote = res.detail;
    } catch (e) {
      router = "failed";
      rosNote = `gagal di router: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }
  await db`update customers set status = 'aktif', updated_at = now() where id = ${customerId}`;
  return { ok: true, detail: `Isolir dibuka (mode ${m}). ${rosNote}.`, router };
}

/**
 * Sinkron user pelanggan ke router: buat PPP secret / hotspot user bila belum ada,
 * update password bila sudah ada. Kredensial dibuat otomatis bila kosong.
 */
export async function routerSyncCustomer(
  db: Sql,
  customerId: number,
  mode?: "pppoe" | "hotspot"
): Promise<ActionResult & { synced?: { name: string; mode: string } }> {
  const c = await getCustomerFull(db, customerId);
  if (!c) return { ok: false, detail: "Pelanggan tidak ditemukan", router: "skipped" };
  if (!c.router_id || !c.r_host)
    return { ok: false, detail: "Pelanggan belum dipasangkan router", router: "skipped" };
  const m = mode ?? (c.connection_type === "hotspot" ? "hotspot" : "pppoe");
  try {
    const conn = await connectRouter(routerCreds(c));
    try {
      if (m === "hotspot") {
        const name = loginName(c);
        const pass = (c.pppoe_pass as string) || name;
        const exists = await findId(conn, "/ip/hotspot/user", "name", name);
        if (exists) {
          await hotspotUserEnable(conn, name);
        } else {
          await hotspotUserAdd(conn, { name, password: pass, comment: `genisp:${c.code}` });
        }
        return {
          ok: true,
          detail: `Hotspot user "${name}" tersinkron di router`,
          router: "ok",
          synced: { name, mode: m },
        };
      }
      let name = c.pppoe_user as string | null;
      let pass = c.pppoe_pass as string | null;
      if (!name) {
        name = `pppoe-${c.code}`;
        pass = randomCode(8);
        await db`update customers set pppoe_user = ${name}, pppoe_pass = ${pass}, updated_at = now() where id = ${customerId}`;
      } else if (!pass) {
        pass = randomCode(8);
        await db`update customers set pppoe_pass = ${pass}, updated_at = now() where id = ${customerId}`;
      }
      const exists = await findId(conn, "/ppp/secret", "name", name);
      if (exists) {
        await pppSecretSet(conn, name, { password: pass });
      } else {
        await pppSecretAdd(conn, { name, password: pass, comment: `genisp:${c.code}` });
      }
      return {
        ok: true,
        detail: `PPP secret "${name}" tersinkron di router`,
        router: "ok",
        synced: { name, mode: m },
      };
    } finally {
      conn.close();
    }
  } catch (e) {
    return {
      ok: false,
      detail: `Sinkronisasi gagal: ${e instanceof Error ? e.message : "unknown"}`,
      router: "failed",
    };
  }
}

/** Dorong satu voucher ke router sebagai hotspot user (best-effort, bisa dipakai ulang). */
export async function pushVoucherToRouter(db: Sql, voucherId: number): Promise<ActionResult> {
  const rows = await db`
    select v.*, hp.profile as hp_profile, hp.duration_hours,
           r.host as r_host, r.api_port as r_port, r.username as r_user, r.password_enc as r_pass
    from vouchers v
    join hotspot_packages hp on hp.id = v.hotspot_package_id
    left join routers r on r.id = v.router_id
    where v.id = ${voucherId}`;
  const v = rows[0] as CustomerFull | undefined;
  if (!v) return { ok: false, detail: "Voucher tidak ditemukan", router: "skipped" };
  if (!v.router_id || !v.r_host)
    return { ok: false, detail: "Voucher tidak terpasang ke router", router: "skipped" };
  const code = String(v.code);
  const hours = Number(v.duration_hours ?? 24);
  const limitUptime = `${hours}:00:00`;
  try {
    const conn = await connectRouter({
      id: Number(v.router_id),
      host: String(v.r_host),
      api_port: v.r_port ? Number(v.r_port) : 8728,
      username: String(v.r_user ?? ""),
      password_enc: (v.r_pass as string | null) ?? "",
    });
    try {
      const exists = await findId(conn, "/ip/hotspot/user", "name", code);
      if (!exists) {
        await hotspotUserAdd(conn, {
          name: code,
          password: code,
          profile: v.hp_profile ? String(v.hp_profile) : undefined,
          limitUptime,
          comment: `voucher-genisp:${code}`,
        });
      }
      return { ok: true, detail: `Voucher ${code} terkirim ke router`, router: "ok" };
    } finally {
      conn.close();
    }
  } catch (e) {
    return {
      ok: false,
      detail: `Gagal push voucher ${code}: ${e instanceof Error ? e.message : "unknown"}`,
      router: "failed",
    };
  }
}

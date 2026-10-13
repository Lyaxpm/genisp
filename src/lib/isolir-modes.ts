// Lima mode isolir ala PTA (mywifi_helper.php: isolir()/openisolir()), masing-masing x 2 aksi.
//
//   disable      : nonaktifkan user di router (PPP secret / hotspot user) + tendang sesi aktif
//   address-list : masukkan IP pelanggan ke /ip/firewall/address-list list=EXPIRED (comment ISOLIR|<kode>)
//   profile      : pindahkan profile user ke EXPIRED; saat dibuka kembalikan ke profile semula
//   filter-rule  : tambah filter rule chain=forward src-address=<ip> action=drop (comment ISOLIR|<kode>)
//   binding      : /ip/hotspot/ip-binding set type=regular (isolir) / bypassed (buka)
//
// Mode dipilih dengan prioritas: override per-pelanggan (customers.isolir_mode)
//   > global (settings.isolir_mode) > default "disable".
// Setiap fungsi benar-benar mengeksekusi perintah RouterOS (bukan stub).
import { type Sql } from "./db";
import {
  type RosConn,
  type RouterRow,
  connectRouter,
  findId,
  rowsToObjects,
  trapMessage,
  pppSecretDisable,
  pppSecretEnable,
  pppActiveRemove,
  hotspotUserDisable,
  hotspotUserEnable,
  hotspotActiveRemove,
  addressListAdd,
} from "./routeros";

export type IsolirMode = "disable" | "address-list" | "profile" | "filter-rule" | "binding";

export const ISOLIR_MODES: IsolirMode[] = [
  "disable",
  "address-list",
  "profile",
  "filter-rule",
  "binding",
];

export const ISOLIR_MODE_LABELS: Record<IsolirMode, string> = {
  disable: "Nonaktifkan user",
  "address-list": "Address-list EXPIRED",
  profile: "Profile EXPIRED",
  "filter-rule": "Filter rule ISOLIR",
  binding: "IP Binding regular",
};

/** Nama profile isolir, sama seperti PTA. */
export const EXPIRED_PROFILE = "EXPIRED";

/** Komentar penanda isolir di firewall, sama seperti PTA: ISOLIR|<kode pelanggan>. */
export function isolirComment(code: string): string {
  return `ISOLIR|${code}`;
}

export type IsolirCustomer = {
  id: number;
  code: string;
  pppoe_user?: string | null;
  mac_address?: string | null;
  connection_type?: string | null;
  isolir_mode?: string | null;
  isolir_prev_profile?: string | null;
  [k: string]: unknown;
};

export type IsolirModeResult = {
  ok: boolean;
  detail: string;
  /** Profile sebelum dipindah ke EXPIRED (mode profile) — disimpan ke DB oleh pemanggil. */
  prevProfile?: string | null;
};

/* ================= Resolusi mode ================= */

export function normalizeIsolirMode(v: unknown): IsolirMode | null {
  return typeof v === "string" && (ISOLIR_MODES as string[]).includes(v)
    ? (v as IsolirMode)
    : null;
}

/** Prioritas: override pelanggan > global > default "disable". */
export function pickIsolirMode(customerMode: unknown, globalMode: unknown): IsolirMode {
  return normalizeIsolirMode(customerMode) ?? normalizeIsolirMode(globalMode) ?? "disable";
}

/** Baca mode global dari tabel settings (mekanisme settings yang sudah ada). */
export async function getGlobalIsolirMode(db: Sql): Promise<string | null> {
  const rows = await db`select value from settings where key = 'isolir_mode' limit 1`;
  const v = rows[0]?.value;
  return typeof v === "string" && v ? v : null;
}

/** Resolusi mode untuk satu pelanggan (dipakai route isolir/open). */
export async function resolveIsolirModeForCustomer(
  db: Sql,
  customerId: number
): Promise<IsolirMode> {
  const rows = await db`select isolir_mode from customers where id = ${customerId} limit 1`;
  const global = await getGlobalIsolirMode(db);
  return pickIsolirMode(rows[0]?.isolir_mode, global);
}

/* ================= Helper RouterOS ================= */

function loginName(c: IsolirCustomer): string {
  const u = c.pppoe_user as string | null | undefined;
  return (u && u.trim()) || c.code;
}

function isHotspot(c: IsolirCustomer): boolean {
  return String(c.connection_type ?? "pppoe").toLowerCase().startsWith("hotspot");
}

function userPath(c: IsolirCustomer): string {
  return isHotspot(c) ? "/ip/hotspot/user" : "/ppp/secret";
}

/** Set parameter pada entitas user (PPP secret / hotspot user) berdasarkan nama. */
async function setUserParam(
  conn: RosConn,
  c: IsolirCustomer,
  params: Record<string, string>
): Promise<void> {
  const path = userPath(c);
  const user = loginName(c);
  const id = await findId(conn, path, "name", user);
  if (!id) throw new Error(`User "${user}" tidak ditemukan di ${path}`);
  const words = [`${path}/set`, `=.id=${id}`];
  for (const [k, v] of Object.entries(params)) words.push(`=${k}=${v}`);
  const r = await conn.talk(words);
  if (!r.ok) throw new Error(`Gagal mengubah user "${user}": ${trapMessage(r.reply)}`);
}

/** Baca profile user saat ini ("" bila tidak ada). */
async function currentUserProfile(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const path = userPath(c);
  const r = await conn.talk([`${path}/print`, `?name=${loginName(c)}`]);
  if (!r.ok || r.data.length === 0) return "";
  return rowsToObjects(r.data)[0].profile ?? "";
}

/** Tendang sesi aktif pelanggan (best-effort). */
async function kickActive(conn: RosConn, c: IsolirCustomer): Promise<void> {
  const user = loginName(c);
  if (isHotspot(c)) await hotspotActiveRemove(conn, user);
  else await pppActiveRemove(conn, user);
}

/**
 * Cari IP pelanggan di router, meniru PTA:
 * - PPPoE: remote-address dari /ppp/secret (IP statik), fallback address sesi aktif
 * - Hotspot: address dari /ip/hotspot/active
 */
async function resolveCustomerIp(conn: RosConn, c: IsolirCustomer): Promise<string | null> {
  const user = loginName(c);
  if (isHotspot(c)) {
    const r = await conn.talk(["/ip/hotspot/active/print", `?user=${user}`]);
    if (r.ok && r.data.length > 0) {
      const addr = rowsToObjects(r.data)[0].address;
      if (addr) return addr;
    }
    return null;
  }
  const sec = await conn.talk(["/ppp/secret/print", `?name=${user}`]);
  if (sec.ok && sec.data.length > 0) {
    const ra = rowsToObjects(sec.data)[0]["remote-address"];
    if (ra) return ra;
  }
  const act = await conn.talk(["/ppp/active/print", `?name=${user}`]);
  if (act.ok && act.data.length > 0) {
    const addr = rowsToObjects(act.data)[0].address;
    if (addr) return addr;
  }
  return null;
}

/** Hapus semua entri firewall (address-list / filter) yang berkomentar ISOLIR|<kode>. */
async function removeByComment(conn: RosConn, path: string, comment: string): Promise<number> {
  const r = await conn.talk([`${path}/print`, `?comment=${comment}`]);
  if (!r.ok) return 0;
  let n = 0;
  for (const o of rowsToObjects(r.data)) {
    const id = o[".id"];
    if (!id) continue;
    const d = await conn.talk([`${path}/remove`, `=.id=${id}`]);
    if (d.ok) n++;
  }
  return n;
}

/* ================= Mode: disable ================= */

async function isolateDisable(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const user = loginName(c);
  if (isHotspot(c)) {
    await hotspotUserDisable(conn, user);
  } else {
    await pppSecretDisable(conn, user);
  }
  await kickActive(conn, c);
  return `user "${user}" dinonaktifkan di router`;
}

async function openDisable(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const user = loginName(c);
  if (isHotspot(c)) {
    await hotspotUserEnable(conn, user);
  } else {
    await pppSecretEnable(conn, user);
  }
  return `user "${user}" diaktifkan kembali di router`;
}

/* ================= Mode: profile (EXPIRED) ================= */

async function isolateProfile(
  conn: RosConn,
  c: IsolirCustomer
): Promise<{ detail: string; prevProfile: string | null }> {
  const user = loginName(c);
  const before = await currentUserProfile(conn, c);
  if (before === EXPIRED_PROFILE) {
    return {
      detail: `user "${user}" sudah berprofile ${EXPIRED_PROFILE}`,
      prevProfile: EXPIRED_PROFILE,
    };
  }
  await setUserParam(conn, c, { profile: EXPIRED_PROFILE });
  await kickActive(conn, c);
  return {
    detail: `profile user "${user}" dipindah ke ${EXPIRED_PROFILE} (sebelumnya: ${before || "-"})`,
    prevProfile: before || null,
  };
}

async function openProfile(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const user = loginName(c);
  const target = (c.isolir_prev_profile as string | null) || "";
  if (!target || target === EXPIRED_PROFILE) {
    throw new Error(
      `Profile semula user "${user}" tidak tercatat (isolir_prev_profile kosong) — ` +
        `kembalikan manual di router lalu set profile di /ppp/secret atau /ip/hotspot/user`
    );
  }
  await setUserParam(conn, c, { profile: target });
  const after = await currentUserProfile(conn, c);
  if (after !== target) {
    throw new Error(
      `Profile gagal dikembalikan. Masih: ${after || "-"}, seharusnya: ${target}`
    );
  }
  await kickActive(conn, c);
  return `profile user "${user}" dikembalikan ke ${target}`;
}

/* ================= Mode: address-list EXPIRED ================= */

async function isolateAddressList(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const user = loginName(c);
  const ip = await resolveCustomerIp(conn, c);
  if (!ip) {
    throw new Error(
      `IP pelanggan "${user}" tidak ditemukan di router ` +
        `(mode address-list butuh IP statik/aktif; pastikan user online atau isi remote-address)`
    );
  }
  const comment = isolirComment(c.code);
  const existing = await conn.talk(["/ip/firewall/address-list/print", `?comment=${comment}`]);
  if (existing.ok && existing.data.length > 0) {
    return `IP ${ip} sudah ada di address-list EXPIRED (${comment})`;
  }
  await addressListAdd(conn, EXPIRED_PROFILE, ip, comment);
  await kickActive(conn, c);
  return `IP ${ip} dimasukkan ke address-list ${EXPIRED_PROFILE}`;
}

async function openAddressList(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const n = await removeByComment(conn, "/ip/firewall/address-list", isolirComment(c.code));
  return n > 0
    ? `${n} entri address-list isolir dihapus`
    : "tidak ada entri address-list isolir yang perlu dihapus";
}

/* ================= Mode: filter rule ISOLIR ================= */

async function isolateFilterRule(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const user = loginName(c);
  const ip = await resolveCustomerIp(conn, c);
  if (!ip) {
    throw new Error(
      `IP pelanggan "${user}" tidak ditemukan di router ` +
        `(mode filter-rule butuh IP statik/aktif; pastikan user online atau isi remote-address)`
    );
  }
  const comment = isolirComment(c.code);
  const existing = await conn.talk(["/ip/firewall/filter/print", `?comment=${comment}`]);
  if (existing.ok && existing.data.length > 0) {
    return `filter rule isolir untuk ${ip} sudah ada`;
  }
  const r = await conn.talk([
    "/ip/firewall/filter/add",
    "=chain=forward",
    `=src-address=${ip}`,
    "=action=drop",
    `=comment=${comment}`,
  ]);
  if (!r.ok) throw new Error(`Gagal menambah filter rule isolir: ${trapMessage(r.reply)}`);
  await kickActive(conn, c);
  return `filter rule drop ditambahkan untuk ${ip} (${comment})`;
}

async function openFilterRule(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const comment = isolirComment(c.code);
  const nf = await removeByComment(conn, "/ip/firewall/filter", comment);
  const na = await removeByComment(conn, "/ip/firewall/address-list", comment);
  return `filter rule isolir dihapus (${nf}), address-list isolir dihapus (${na})`;
}

/* ================= Mode: binding (hotspot ip-binding) ================= */

async function bindingId(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const mac = (c.mac_address as string | null) || "";
  if (!mac) {
    throw new Error(
      "MAC address pelanggan kosong — mode binding membutuhkan MAC address yang terdaftar"
    );
  }
  const r = await conn.talk(["/ip/hotspot/ip-binding/print", `?mac-address=${mac}`]);
  if (!r.ok || r.data.length === 0) {
    throw new Error(`IP binding untuk MAC ${mac} tidak ditemukan di router`);
  }
  const id = rowsToObjects(r.data)[0][".id"];
  if (!id) throw new Error(`IP binding untuk MAC ${mac} tidak memiliki .id`);
  return id;
}

async function isolateBinding(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const mac = (c.mac_address as string) || "";
  const id = await bindingId(conn, c);
  const r = await conn.talk(["/ip/hotspot/ip-binding/set", `=.id=${id}`, "=type=regular"]);
  if (!r.ok) throw new Error(`Gagal mengisolir ip-binding: ${trapMessage(r.reply)}`);
  return `ip-binding ${mac} diset ke regular (terisolir)`;
}

async function openBinding(conn: RosConn, c: IsolirCustomer): Promise<string> {
  const mac = (c.mac_address as string) || "";
  const id = await bindingId(conn, c);
  const r = await conn.talk(["/ip/hotspot/ip-binding/set", `=.id=${id}`, "=type=bypassed"]);
  if (!r.ok) throw new Error(`Gagal membuka ip-binding: ${trapMessage(r.reply)}`);
  const v = await conn.talk(["/ip/hotspot/ip-binding/print", `?mac-address=${mac}`]);
  const t = v.ok && v.data.length > 0 ? rowsToObjects(v.data)[0].type : "";
  if (t !== "bypassed") {
    throw new Error(`IP binding gagal dibuka. Masih: ${t || "-"}, seharusnya: bypassed`);
  }
  return `ip-binding ${mac} diset ke bypassed (terbuka)`;
}

/* ================= Entry point ================= */

/**
 * Isolir pelanggan di router memakai mode yang diminta.
 * router: baris routers (host, api_port, username, password_enc base64).
 */
export async function isolateCustomer(
  router: RouterRow,
  customer: IsolirCustomer,
  mode: IsolirMode
): Promise<IsolirModeResult> {
  const m = normalizeIsolirMode(mode) ?? "disable";
  const conn = await connectRouter(router);
  try {
    switch (m) {
      case "disable":
        return { ok: true, detail: await isolateDisable(conn, customer) };
      case "address-list":
        return { ok: true, detail: await isolateAddressList(conn, customer) };
      case "profile": {
        const r = await isolateProfile(conn, customer);
        return { ok: true, detail: r.detail, prevProfile: r.prevProfile };
      }
      case "filter-rule":
        return { ok: true, detail: await isolateFilterRule(conn, customer) };
      case "binding":
        return { ok: true, detail: await isolateBinding(conn, customer) };
    }
  } finally {
    conn.close();
  }
}

/** Buka isolir pelanggan di router memakai mode yang diminta. */
export async function openCustomer(
  router: RouterRow,
  customer: IsolirCustomer,
  mode: IsolirMode
): Promise<IsolirModeResult> {
  const m = normalizeIsolirMode(mode) ?? "disable";
  const conn = await connectRouter(router);
  try {
    switch (m) {
      case "disable":
        return { ok: true, detail: await openDisable(conn, customer) };
      case "address-list":
        return { ok: true, detail: await openAddressList(conn, customer) };
      case "profile":
        return { ok: true, detail: await openProfile(conn, customer) };
      case "filter-rule":
        return { ok: true, detail: await openFilterRule(conn, customer) };
      case "binding":
        return { ok: true, detail: await openBinding(conn, customer) };
    }
  } finally {
    conn.close();
  }
}

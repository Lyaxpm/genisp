// Handler job bawaan untuk worker queue (/api/queue/run).
// Dipetakan dari PTA: Cron::hotspot_auto_clean, Cron::router_olt_check,
// Schedule::scheduleBirthday, Schedule::backupdatabase, delldoublebill, fixduedate.
import { sql, type Sql } from "./db";
import { trySendWhatsapp, sendFcm } from "./notify";
import { fillTemplate } from "./utils";
import {
  connectRouter,
  rowsToObjects,
  hotspotUserRemove,
  testConnection,
  type RouterRow,
} from "./routeros";

async function getSetting(db: Sql, key: string, fallback = ""): Promise<string> {
  const rows = await db`select value from settings where key = ${key} limit 1`;
  return rows.length ? String(rows[0].value ?? fallback) : fallback;
}

async function logActivity(db: Sql, action: string, detail: string) {
  try {
    await db`insert into activity_logs (action, detail) values (${action}, ${detail})`;
  } catch {
    /* abaikan */
  }
}

// Baris routers dari DB (RouterRow di routeros.ts tidak memuat name/status).
type RouterDbRow = RouterRow & {
  name: string;
  is_active: boolean;
  last_status?: string | null;
};

/* ================= hotspot_auto_clean ================= */
// Hapus user hotspot yang expired di router: uptime >= limit-uptime,
// bytes terpakai >= limit-bytes-total, atau comment berisi tanggal kedaluwarsa
// yang sudah lewat (format PTA: tanggal + spasi + X, atau YYYY-MM-DD HH:mm).
function parseDuration(s: string): number {
  const str = String(s ?? "").trim();
  if (!str || str === "0" || str === "0s" || str === "00:00:00") return 0;
  const m1 = str.match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m1 && !str.includes(":")) {
    return (+m1[1] || 0) * 604800 + (+m1[2] || 0) * 86400 + (+m1[3] || 0) * 3600 + (+m1[4] || 0) * 60 + (+m1[5] || 0);
  }
  const m2 = str.match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (m2) {
    return (+m2[1] || 0) * 604800 + (+m2[2] || 0) * 86400 + (+m2[3] || 0) * 3600 + (+m2[4] || 0) * 60 + (+m2[5] || 0);
  }
  return 0;
}

function commentExpired(comment: string): boolean {
  const c = String(comment ?? "").trim();
  if (!c) return false;
  let m = c.match(/([a-zA-Z]{3}\/\d{1,2}(?:\/\d{4})?\s+\d{1,2}:\d{2}(?::\d{2})?)\s+([XN])/i);
  if (m) {
    if (m[2].toUpperCase() === "X") {
      const ts = Date.parse(m[1]);
      if (!Number.isNaN(ts) && ts < Date.now()) return true;
    }
    return false;
  }
  m = c.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
  if (m) {
    const ts = Date.parse(m[1]);
    if (!Number.isNaN(ts) && ts < Date.now()) return true;
  }
  return /expired/i.test(c);
}

export async function hotspotAutoClean(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const db = sql();
  const routerId = payload.router_id ? Number(payload.router_id) : null;
  const routers = (
    routerId
      ? await db`select * from routers where id = ${routerId} and is_active = true`
      : await db`select * from routers where is_active = true order by id`
  ) as RouterDbRow[];
  let checked = 0;
  let deleted = 0;
  const errors: string[] = [];
  for (const r of routers) {
    checked++;
    let conn = null;
    try {
      conn = await connectRouter(r, 8000);
      const res = await conn.talk(["/ip/hotspot/user/print"]);
      if (!res.ok) throw new Error("print hotspot user gagal");
      for (const u of rowsToObjects(res.data)) {
        const name = (u.name ?? "").trim();
        const id = u[".id"];
        if (!name || !id || name === "default-trial") continue;
        let exp = false;
        if (u["limit-uptime"]) {
          const lim = parseDuration(u["limit-uptime"]);
          const used = parseDuration(u.uptime ?? "0s");
          if (lim > 0 && used >= lim) exp = true;
        }
        if (!exp && u["limit-bytes-total"]) {
          const lim = Number(u["limit-bytes-total"]);
          const used = Number(u["bytes-in"] ?? 0) + Number(u["bytes-out"] ?? 0);
          if (lim > 0 && used >= lim) exp = true;
        }
        if (!exp && u.comment && commentExpired(u.comment)) exp = true;
        if (exp) {
          await hotspotUserRemove(conn, name);
          deleted++;
          // Sinkronkan status voucher lokal (best-effort).
          try {
            await db`update vouchers set status = 'expired' where router_id = ${r.id} and code = ${name} and status = 'active'`;
          } catch {
            /* abaikan */
          }
        }
      }
      await logActivity(db, "queue:hotspot_auto_clean", `router=${r.name} deleted=${deleted}`);
    } catch (e) {
      errors.push(`${r.name}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      try {
        conn?.close();
      } catch {
        /* abaikan */
      }
    }
  }
  if (errors.length) throw new Error(`checked=${checked} deleted=${deleted}; errors: ${errors.join(" | ")}`);
  return { routers: checked, deleted };
}

/* ================= birthday_wa ================= */
// Kirim ucapan ulang tahun via WA ke customer yang berulang tahun hari ini.
// Anti-dobel: dicek di tabel notifications (marker [birthday-wa] per hari).
const BIRTHDAY_MARKER = "[birthday-wa]";

export async function birthdayWa(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const db = sql();
  const batch = Math.min(Number(payload.batch) || 200, 1000);
  const tpl =
    (await getSetting(db, "wa_birthday")) ||
    "Selamat ulang tahun {nama}! Terima kasih telah setia bersama {perusahaan}.";
  const comp = (await db`select name from company where id = 1`)[0];
  const companyName = String(comp?.name ?? "GenISP");

  const customers = await db`select id, name, phone from customers
    where birth_date is not null
      and to_char(birth_date, 'MM-DD') = to_char(current_date, 'MM-DD')
      and phone is not null and phone <> ''
      and status <> 'nonaktif'
    order by id limit ${batch}`;

  let sent = 0;
  let skipped = 0;
  for (const c of customers) {
    const phone = String(c.phone);
    const already = await db`select 1 from notifications
      where channel = 'whatsapp' and recipient = ${phone}
        and date(created_at) = current_date and message like ${"%" + BIRTHDAY_MARKER + "%"}
      limit 1`;
    if (already.length) {
      skipped++;
      continue;
    }
    const msg = fillTemplate(tpl, { nama: String(c.name), perusahaan: companyName }) + `\n${BIRTHDAY_MARKER}`;
    try {
      await trySendWhatsapp(phone, msg);
      sent++;
    } catch {
      skipped++;
    }
  }
  await logActivity(db, "queue:birthday_wa", `sent=${sent} skipped=${skipped} total=${customers.length}`);
  return { total: customers.length, sent, skipped };
}

/* ================= db_backup ================= */
// Dump SQL tabel-tabel inti → simpan di tabel backups (endpoint download: /api/queue/backups).
const BACKUP_TABLES = [
  "users", "roles", "company", "settings", "packages", "routers", "customers",
  "invoices", "invoice_items", "payments", "confirm_payments", "hotspot_packages",
  "vouchers", "olts", "odcs", "odps", "incomes", "expenditures",
];

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (v instanceof Date) return `'${v.toISOString().replace("T", " ").slice(0, 19)}'`;
  if (Array.isArray(v)) return `'{${v.map((x) => String(x).replace(/"/g, '\\"')).join(",")}}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

export async function dbBackup(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const db = sql();
  const maxRows = Math.min(Number(payload.max_rows) || 20000, 100000);
  const tables = (Array.isArray(payload.tables) && payload.tables.length ? payload.tables : BACKUP_TABLES).filter(
    (t): t is string => typeof t === "string" && /^[a-z_]+$/.test(t)
  );
  const dumped: string[] = [];
  let rowCount = 0;
  const parts: string[] = [
    "-- GenISP database backup",
    `-- generated: ${new Date().toISOString()}`,
    "begin;",
  ];
  for (const t of tables) {
    let rows: Record<string, unknown>[];
    try {
      rows = (await db.unsafe(`select * from "${t}" order by 1 limit ${maxRows}`)) as Record<string, unknown>[];
    } catch {
      continue; // tabel tidak ada → lewati
    }
    if (!rows.length) continue;
    dumped.push(t);
    const cols = Object.keys(rows[0]);
    for (const r of rows) {
      parts.push(`insert into "${t}" (${cols.map((c) => `"${c}"`).join(", ")}) values (${cols.map((c) => sqlLiteral(r[c])).join(", ")});`);
      rowCount++;
    }
  }
  parts.push("commit;");
  const data = parts.join("\n");
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const name = `backup-${stamp}.sql`;

  await db`insert into backups (name, size_bytes, tables, row_count, data, status)
    values (${name}, ${data.length}, ${dumped}, ${rowCount}, ${data}, 'done')`;

  // Retensi: hapus backup lebih tua dari N hari.
  const retentionDays = Number((await getSetting(db, "db_backup_retention", "14")) || 14);
  if (retentionDays > 0) {
    await db`delete from backups where created_at < now() - make_interval(days => ${retentionDays})`;
  }
  await logActivity(db, "queue:db_backup", `name=${name} tables=${dumped.length} rows=${rowCount}`);
  return { name, tables: dumped.length, rows: rowCount, size: data.length };
}

/* ================= router_olt_check ================= */
// Cek koneksi tiap router via RouterOS API; bila transisi ke offline → kirim FCM.
// OLT: kode probe ditulis, TAPI DITANDAI UNTESTED (tanpa perangkat) —
// tidak mengirim notifikasi agar tidak ada false alarm.
export async function routerOltCheck(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const db = sql();
  const timeout = Number(payload.timeout_ms) || 5000;
  const routers = (await db`select * from routers where is_active = true order by id`) as RouterDbRow[];
  let online = 0;
  let offline = 0;
  let transitions = 0;
  const offlineNames: string[] = [];

  for (const r of routers) {
    let ok = false;
    let err = "";
    try {
      const conn = await connectRouter(r, timeout);
      conn.close();
      ok = true;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    const prev = r.last_status ?? null;
    const nowStatus = ok ? "online" : "offline";
    if (ok) {
      online++;
      await db`update routers set last_status = 'online', last_seen_at = now(), last_checked_at = now() where id = ${r.id}`;
    } else {
      offline++;
      offlineNames.push(r.name);
      await db`update routers set last_status = 'offline', last_checked_at = now() where id = ${r.id}`;
      // Transisi online→offline (atau belum pernah tercatat): kirim FCM sekali.
      if (prev !== "offline") {
        transitions++;
        const tokens = await db`select token from fcm_tokens`;
        for (const t of tokens) {
          try {
            await sendFcm(String(t.token), "Router Offline", `${r.name} tidak dapat dihubungi: ${err}`.slice(0, 180));
          } catch {
            /* abaikan */
          }
        }
      }
    }
  }

  /* ---------- OLT (UNTESTED — tanpa perangkat; tidak kirim notifikasi) ---------- */
  // Kode di bawah hanya probe TCP sederhana dan pencatatan status.
  // JANGAN jadikan acuan operasional sebelum diuji dengan perangkat OLT asli.
  const olts = await db`select * from olts where is_active = true and host is not null and host <> '' order by id`;
  let oltChecked = 0;
  for (const o of olts) {
    oltChecked++;
    const probePort = Number(payload.olt_port) || 23;
    const probe = await testConnection(String(o.host), probePort, timeout).catch(() => ({ ok: false, latencyMs: 0 }));
    // UNTESTED: simpan hasil probe apa adanya, TANPA notifikasi transisi.
    await db`update olts set last_status = ${probe.ok ? "online" : "offline"}, last_checked_at = now() where id = ${o.id}`;
  }

  await logActivity(
    db,
    "queue:router_olt_check",
    `routers checked=${routers.length} online=${online} offline=${offline} transitions=${transitions} olts=${oltChecked}(UNTESTED)`
  );
  return { routers: routers.length, online, offline, offlineNames, transitions, olts: oltChecked, olt_note: "UNTESTED-tanpa-perangkat" };
}

/* ================= maintenance ================= */
// delldoublebill: hapus invoice UNPAID duplikat (customer_id + period), pertahankan yang tertua (id terkecil).
// fixduedate: perbaiki due_date yang invalid (sebelum awal periode) → akhir bulan periode.
export async function maintenanceJob(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const db = sql();
  const parts = Array.isArray(payload.parts) ? payload.parts : ["delldoublebill", "fixduedate"];
  const result: Record<string, unknown> = {};

  if (parts.includes("delldoublebill")) {
    const res = await db`delete from invoices where id in (
      select id from (
        select id, row_number() over (partition by customer_id, period order by id asc) as rn
        from invoices where status = 'unpaid'
      ) t where rn > 1
    )`;
    result.duplicates_deleted = res.count;
  }

  if (parts.includes("fixduedate")) {
    const res = await db`update invoices
      set due_date = ((period || '-01')::date + interval '1 month' - interval '1 day')::date
      where due_date is null
         or due_date < (period || '-01')::date
         or due_date > ((period || '-01')::date + interval '2 months')::date`;
    result.due_dates_fixed = res.count;
  }

  await logActivity(db, "queue:maintenance", JSON.stringify(result));
  return result;
}

/** Dispatcher dipakai worker /api/queue/run. */
export async function runJobHandler(
  jobType: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (jobType) {
    case "hotspot_auto_clean":
      return hotspotAutoClean(payload);
    case "birthday_wa":
      return birthdayWa(payload);
    case "db_backup":
      return dbBackup(payload);
    case "router_olt_check":
      return routerOltCheck(payload);
    case "maintenance":
      return maintenanceJob(payload);
    default:
      throw new Error(`Handler tidak dikenal: ${jobType}`);
  }
}

import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Konfigurasi scheduler sinkron MikroTik hotspot (disimpan di tabel settings).
// Dikonsumsi oleh GET /api/hotspot/scheduler/run (dipanggil cron tiap interval_minutes).
const KEYS = [
  "hotspot_sched_enabled",
  "hotspot_sched_interval_minutes",
  "hotspot_sched_auto_clean_expired",
] as const;

const DEFAULTS: Record<string, string> = {
  hotspot_sched_enabled: "0",
  hotspot_sched_interval_minutes: "60",
  hotspot_sched_auto_clean_expired: "1",
};

async function readConfig(db: Sql): Promise<Record<string, string>> {
  const rows = await db`select key, value from settings where key = any(${KEYS as unknown as string[]})`;
  const cfg: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) cfg[r.key as string] = r.value as string;
  return cfg;
}

export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  return ok({ config: await readConfig(db), note: "UNTESTED-live: butuh router fisik untuk verifikasi." });
}

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Body tidak valid", 400);
  const db = sql();
  const interval = Number(body.interval_minutes);
  const values: Record<string, string> = {
    hotspot_sched_enabled: body.enabled === true ? "1" : "0",
    hotspot_sched_interval_minutes:
      Number.isFinite(interval) && interval >= 5 ? String(Math.floor(interval)) : "60",
    hotspot_sched_auto_clean_expired: body.auto_clean_expired === false ? "0" : "1",
  };
  for (const [k, v] of Object.entries(values)) {
    await db`insert into settings (key, value) values (${k}, ${v})
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  }
  return ok({ config: await readConfig(db) });
}

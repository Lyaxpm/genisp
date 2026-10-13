// Job queue persisten: enqueue / claim atomik / done / failed+retry / list / retry.
// Worker: GET /api/queue/run (proteksi CRON_SECRET).
import { sql } from "./db";
import type { JSONValue } from "postgres";

export const JOB_TYPES = [
  "hotspot_auto_clean",
  "birthday_wa",
  "db_backup",
  "router_olt_check",
  "maintenance",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export type JobStatus = "pending" | "running" | "done" | "failed";

export type CronJob = {
  id: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_at: string;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export function isJobType(t: unknown): t is JobType {
  return typeof t === "string" && (JOB_TYPES as readonly string[]).includes(t);
}

/** Tambah job ke antrean. runAt: Date atau ISO string (default: sekarang). */
export async function enqueue(
  jobType: string,
  payload: Record<string, unknown> = {},
  runAt?: Date | string,
  maxAttempts = 3
): Promise<CronJob> {
  if (!isJobType(jobType)) throw new Error(`job_type tidak dikenal: ${jobType}`);
  const db = sql();
  const runAtIso =
    runAt instanceof Date ? runAt.toISOString() : typeof runAt === "string" ? runAt : new Date().toISOString();
  const rows = await db`insert into cronjobs (job_type, payload, run_at, max_attempts)
    values (${jobType}, ${db.json(payload as unknown as JSONValue)}, ${runAtIso}::timestamptz, ${Math.max(1, maxAttempts)})
    returning *`;
  return rows[0] as CronJob;
}

/**
 * Klaim satu job yang sudah jatuh tempo secara atomik.
 * Pakai SELECT ... FOR UPDATE SKIP LOCKED di dalam UPDATE sehingga dua worker
 * tidak bisa mengambil job yang sama.
 */
export async function claimNext(): Promise<CronJob | null> {
  const db = sql();
  const rows = await db`update cronjobs
    set status = 'running', attempts = attempts + 1, started_at = now()
    where id = (
      select id from cronjobs
      where status = 'pending' and run_at <= now()
      order by run_at asc, created_at asc
      limit 1
      for update skip locked
    )
    returning *`;
  return (rows[0] as CronJob) ?? null;
}

export async function markDone(id: string): Promise<void> {
  const db = sql();
  await db`update cronjobs set status = 'done', finished_at = now(), last_error = null where id = ${id}`;
}

/**
 * Gagalkan job: selama attempts < max_attempts dijadwalkan ulang dengan backoff
 * (5 menit × attempts), selebihnya ditandai 'failed'.
 */
export async function markFailed(id: string, error: string): Promise<JobStatus> {
  const db = sql();
  const rows = await db`select attempts, max_attempts from cronjobs where id = ${id} limit 1`;
  if (!rows.length) return "failed";
  const attempts = Number(rows[0].attempts);
  const max = Number(rows[0].max_attempts);
  if (attempts < max) {
    await db`update cronjobs
      set status = 'pending', last_error = ${error.slice(0, 2000)},
          run_at = now() + make_interval(mins => ${attempts * 5})
      where id = ${id}`;
    return "pending";
  }
  await db`update cronjobs set status = 'failed', finished_at = now(), last_error = ${error.slice(0, 2000)} where id = ${id}`;
  return "failed";
}

export async function listJobs(limit = 100, status?: JobStatus): Promise<CronJob[]> {
  const db = sql();
  const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const rows = status
    ? await db`select * from cronjobs where status = ${status} order by created_at desc limit ${n}`
    : await db`select * from cronjobs order by created_at desc limit ${n}`;
  return rows as unknown as CronJob[];
}

/** Kembalikan job 'failed' ke antrean (reset attempts). */
export async function retryJob(id: string): Promise<CronJob | null> {
  const db = sql();
  const rows = await db`update cronjobs
    set status = 'pending', attempts = 0, last_error = null, run_at = now(),
        started_at = null, finished_at = null
    where id = ${id} and status = 'failed'
    returning *`;
  return (rows[0] as CronJob) ?? null;
}

export async function jobStats(): Promise<Record<JobStatus, number>> {
  const db = sql();
  const rows = await db`select status, count(*)::int as n from cronjobs group by status`;
  const out: Record<JobStatus, number> = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const r of rows) out[r.status as JobStatus] = Number(r.n);
  return out;
}

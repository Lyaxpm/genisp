// GET /api/queue/run — WORKER job queue (proteksi CRON_SECRET, dipanggil Vercel Cron tiap 5 menit).
// Mengklaim job yang jatuh tempo satu per satu (atomik via SKIP LOCKED) lalu mengeksekusinya.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { claimNext, markDone, markFailed } from "@/lib/queue";
import { runJobHandler } from "@/lib/queue-jobs";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // beri ruang untuk beberapa job per tick

const MAX_JOBS_PER_TICK = 5;

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
    return fail("Unauthorized", 401);

  const results: Array<{ id: string; job_type: string; status: string; result?: unknown; error?: string }> = [];
  for (let i = 0; i < MAX_JOBS_PER_TICK; i++) {
    const job = await claimNext().catch(() => null);
    if (!job) break;
    const started = Date.now();
    try {
      const res = await runJobHandler(job.job_type, job.payload ?? {});
      await markDone(job.id);
      results.push({ id: job.id, job_type: job.job_type, status: "done", result: res });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const final = await markFailed(job.id, msg).catch(() => "failed" as const);
      results.push({ id: job.id, job_type: job.job_type, status: final, error: msg });
    }
    try {
      const db = sql();
      await db`insert into activity_logs (action, detail)
        values ('queue:run', ${`id=${job.id} type=${job.job_type} status=${results[results.length - 1].status} ms=${Date.now() - started}`})`;
    } catch {
      /* abaikan */
    }
  }
  return ok({ processed: results.length, results });
}

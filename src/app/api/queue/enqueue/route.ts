// POST /api/queue/enqueue — antrekan job baru (auth: staff admin/superadmin).
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession, can } from "@/lib/auth";
import { enqueue, isJobType } from "@/lib/queue";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff" || !can(s, "superadmin", "admin")) return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body || !isJobType(body.job_type)) return fail("job_type tidak valid", 400);
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};
  const maxAttempts = Math.min(Math.max(Number(body.max_attempts) || 3, 1), 10);
  const runAt = typeof body.run_at === "string" && body.run_at ? body.run_at : undefined;

  try {
    const job = await enqueue(body.job_type, payload, runAt, maxAttempts);
    try {
      const db = sql();
      await db`insert into activity_logs (user_id, action, detail)
        values (${s.id}, 'queue:enqueue', ${`job_type=${job.job_type} id=${job.id} by=${s.email}`})`;
    } catch {
      /* abaikan */
    }
    return ok({ job }, 201);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Gagal mengantrekan job", 500);
  }
}

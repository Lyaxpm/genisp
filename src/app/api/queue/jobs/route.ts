// GET /api/queue/jobs — daftar job (auth: staff).
// POST /api/queue/jobs — { action: "retry", id } kembalikan job failed ke antrean (auth: admin/superadmin).
import { NextRequest } from "next/server";
import { getSession, can } from "@/lib/auth";
import { listJobs, retryJob, jobStats, type JobStatus } from "@/lib/queue";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const q = req.nextUrl.searchParams;
  const status = q.get("status") as JobStatus | null;
  const limit = Number(q.get("limit")) || 100;
  const valid = ["pending", "running", "done", "failed"].includes(status ?? "");
  const [items, stats] = await Promise.all([
    listJobs(limit, valid ? (status as JobStatus) : undefined),
    jobStats(),
  ]);
  return ok({ items, stats });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff" || !can(s, "superadmin", "admin")) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (body?.action !== "retry" || !body?.id) return fail("action=retry dan id wajib diisi", 400);
  const job = await retryJob(String(body.id));
  if (!job) return fail("Job tidak ditemukan atau statusnya bukan failed", 404);
  return ok({ job });
}

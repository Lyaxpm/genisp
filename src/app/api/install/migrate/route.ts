import fs from "fs";
import path from "path";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Kode error Postgres yang berarti "sudah ada" → boleh dilewati dengan aman.
const TOLERABLE_CODES = new Set([
  "42710", // duplicate_object (extension, constraint, dll)
  "42P07", // duplicate_table
  "42P06", // duplicate_schema
  "42723", // duplicate_function
  "42701", // duplicate_column
  "23505", // unique_violation (seed di-rerun)
]);

function isTolerable(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  if (code && TOLERABLE_CODES.has(code)) return true;
  const msg = String((e as Error)?.message ?? "").toLowerCase();
  return msg.includes("already exists") || msg.includes("sudah ada");
}

// POST /api/install/migrate — jalankan supabase/migrations/*.sql berurutan
// memakai koneksi DATABASE_URL (service-level), sama seperti scripts/migrate.js.
export async function POST() {
  if (!process.env.DATABASE_URL) return fail("DATABASE_URL belum diisi", 500);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch (e) {
    return fail(`Folder migrasi tidak ditemukan: ${(e as Error).message}`, 500);
  }
  if (files.length === 0) return fail("Tidak ada file .sql di supabase/migrations", 500);

  const db = sql();
  const results: { file: string; status: "ok" | "skipped" | "error"; detail?: string }[] = [];
  let failed = false;

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    try {
      await db.unsafe(content);
      results.push({ file, status: "ok" });
    } catch (e) {
      if (isTolerable(e)) {
        results.push({ file, status: "skipped", detail: (e as Error).message });
        continue;
      }
      results.push({ file, status: "error", detail: (e as Error).message });
      failed = true;
      break; // hentikan berurutan pada error asli, jangan lanjut setengah jalan
    }
  }

  return ok({ files: results, failed });
}

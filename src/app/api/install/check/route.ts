import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REQUIRED_ENV = [
  { key: "DATABASE_URL", label: "Koneksi database (Postgres / Supabase)" },
  { key: "JWT_SECRET", label: "Kunci sesi login (JWT)" },
];

const OPTIONAL_ENV = [
  { key: "CRON_SECRET", label: "Pengaman endpoint cron" },
  { key: "XENDIT_SECRET_KEY", label: "Gateway Xendit" },
  { key: "MIDTRANS_SERVER_KEY", label: "Gateway Midtrans" },
  { key: "TRIPAY_API_KEY", label: "Gateway Tripay" },
  { key: "WHATSAPP_API_URL", label: "Notifikasi WhatsApp" },
  { key: "TELEGRAM_BOT_TOKEN", label: "Notifikasi Telegram" },
];

// GET /api/install/check — cek kebutuhan sistem langkah 1 wizard
export async function GET() {
  try {
    const nodeVersion = process.version;
    const major = Number(nodeVersion.replace(/^v/, "").split(".")[0]);
    const nodeOk = Number.isFinite(major) && major >= 18;

    const required = REQUIRED_ENV.map(({ key, label }) => ({
      key,
      label,
      present: Boolean(process.env[key]),
    }));
    const optional = OPTIONAL_ENV.map(({ key, label }) => ({
      key,
      label,
      present: Boolean(process.env[key]),
    }));

    let dbOk = false;
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    let pgVersion: string | null = null;
    if (required.every((r) => r.present)) {
      try {
        const db = sql();
        const t0 = Date.now();
        const r = await db`select version() as v`;
        dbLatencyMs = Date.now() - t0;
        dbOk = true;
        pgVersion = String(r[0]?.v ?? "").split(" ").slice(0, 2).join(" ");
      } catch (e) {
        dbError = (e as Error).message;
      }
    } else {
      dbError = "DATABASE_URL belum diisi";
    }

    const allOk = nodeOk && required.every((r) => r.present) && dbOk;
    return ok({ nodeVersion, nodeOk, required, optional, dbOk, dbLatencyMs, dbError, pgVersion, allOk });
  } catch (e) {
    return fail(`Gagal menjalankan cek sistem: ${(e as Error).message}`, 500);
  }
}

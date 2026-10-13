import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET"];

async function probe() {
  const envPresent = Object.fromEntries(REQUIRED_ENV.map((k) => [k, Boolean(process.env[k])]));
  const out = {
    node: process.version,
    nodeOk: false,
    env: envPresent,
    envOk: false,
    dbReachable: false,
    tablesOk: false,
    adminExists: false,
    companySet: false,
    completed: false,
  };

  const major = Number(process.version.replace(/^v/, "").split(".")[0]);
  out.nodeOk = Number.isFinite(major) && major >= 18;
  out.envOk = REQUIRED_ENV.every((k) => envPresent[k]);

  if (!out.envOk) return out;
  try {
    const db = sql();
    await db`select 1 as one`;
    out.dbReachable = true;

    const t = await db`
      select count(*)::int as n from information_schema.tables
      where table_schema = 'public' and table_name in ('users','company','settings','roles')
    `;
    out.tablesOk = Number(t[0]?.n ?? 0) >= 4;

    if (out.tablesOk) {
      const a = await db`select 1 from users where role in ('superadmin','admin') and is_active = true limit 1`;
      out.adminExists = a.length > 0;
      const c = await db`select name from company where id = 1`;
      out.companySet = c.length > 0 && Boolean(String(c[0]?.name ?? "").trim());
      const s = await db`select value from settings where key = 'install_completed_at'`;
      out.completed = s.length > 0;
    }
  } catch {
    out.dbReachable = false;
  }
  return out;
}

// GET /api/install/status — ringkasan status instalasi (dipakai guard & wizard)
export async function GET() {
  try {
    return ok(await probe());
  } catch (e) {
    return fail(`Gagal membaca status: ${(e as Error).message}`, 500);
  }
}

// POST /api/install/status { finish: true } — tandai instalasi selesai
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || body.finish !== true) return fail("Payload tidak valid", 400);
  const st = await probe();
  if (!st.dbReachable || !st.tablesOk) return fail("Database belum siap", 409);
  if (!st.adminExists) return fail("Admin belum dibuat", 409);
  try {
    const db = sql();
    await db`
      insert into settings (key, value, updated_at) values ('install_completed_at', now()::text, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
    return ok({ finished: true });
  } catch (e) {
    return fail(`Gagal menandai selesai: ${(e as Error).message}`, 500);
  }
}

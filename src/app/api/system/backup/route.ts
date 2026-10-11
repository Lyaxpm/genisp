import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";
import { BACKUP_TABLES } from "@/lib/system";

export const dynamic = "force-dynamic";

// Tabel utama yang ikut dibackup (urutan: parent dulu, child kemudian).

const NO_HASH_TABLES: Record<string, string> = {
  users: "id, name, email, role, is_active, last_login_at, created_at, updated_at",
  partners: "id, name, email, phone, commission_percent, wallet_balance, is_active, created_at",
};

export async function GET() {
  const s = await getSession("sistem");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  if (s.role !== "superadmin") return fail("Khusus superadmin", 403);
  const db = sql();
  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    // t berasal dari allowlist konstanta (bukan input user) -> aman untuk unsafe
    if (!/^[a-z_]+$/.test(t)) continue;
    try {
      const cols = NO_HASH_TABLES[t];
      const rows = await db.unsafe(cols ? `select ${cols} from "${t}" order by 1` : `select * from "${t}" order by 1`);
      data[t] = rows as unknown[];
    } catch {
      data[t] = [];
    }
  }
  return ok({
    app: "GenISP",
    version: "1.0",
    exported_at: new Date().toISOString(),
    exported_by: s.email,
    data,
  });
}

// Ubah config NON-SECRET sebuah integrasi (staff).
// Secret tidak bisa diubah dari sini — hanya via environment variable.
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail } from "@/lib/utils";
import { staff, writeSettings, looksSecret } from "../../settings/_lib";
import { findIntegration, configKey } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  if (!(await staff())) return fail("Unauthorized", 401);
  const integ = findIntegration(params.key);
  if (!integ) return fail(`Integrasi "${params.key}" tidak dikenal`, 404);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const config = body?.config as Record<string, unknown> | undefined;
  if (!config || typeof config !== "object")
    return fail("Body harus berisi { config: { ... } }", 400);

  const db = sql();
  const pairs: Record<string, string> = {};
  for (const [k, v] of Object.entries(config)) {
    if (looksSecret(k))
      return fail(
        `Field "${k}" terlihat seperti secret — tidak boleh disimpan di database. Set via environment variable.`,
        400
      );
    const field = integ.config.find((c) => c.key === k);
    if (!field)
      return fail(`Field "${k}" tidak dikenal untuk integrasi ${integ.name}`, 400);
    let val = String(v ?? "");
    if (field.type === "boolean")
      val = v === true || v === "true" || v === "1" || v === 1 ? "true" : "false";
    pairs[configKey(integ.key, k)] = val;
  }
  if (!Object.keys(pairs).length) return fail("Tidak ada config untuk disimpan", 400);
  await writeSettings(db, pairs);
  return ok({ saved: true, key: integ.key });
}

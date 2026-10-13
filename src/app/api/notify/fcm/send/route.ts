import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail, fillTemplate } from "@/lib/utils";
import { sendFcm } from "@/lib/notify";

export const dynamic = "force-dynamic";

// POST (staff): kirim push FCM memakai template.
// body: { template: 'bill'|'paid'|..., vars?: {...} } + target:
//   - customer_id: kirim ke semua token milik pelanggan
//   - tokens: string[] token langsung
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const tplName = String(body?.template ?? "").trim();
  if (!tplName) return fail("template wajib diisi", 400);

  const db = sql();
  const tpl = (await db`select title, body from fcm_templates where name = ${tplName} limit 1`)[0];
  if (!tpl) return fail(`template "${tplName}" tidak ditemukan`, 404);

  const vars: Record<string, string> = {};
  const rawVars = body?.vars;
  if (rawVars && typeof rawVars === "object") {
    for (const k of Object.keys(rawVars)) vars[k] = String(rawVars[k]);
  }

  let tokens: string[] = [];
  const customerId = Number(body?.customer_id ?? 0);
  if (customerId) {
    const cust = (await db`select name from customers where id = ${customerId} limit 1`)[0];
    if (!cust) return fail("customer_id tidak ditemukan", 404);
    vars.nama ??= String(cust.name);
    const rows = await db`select token from fcm_tokens where owner_type = 'customer' and owner_id = ${customerId}`;
    tokens = rows.map((r) => String(r.token));
    if (!tokens.length) return fail("Pelanggan tidak punya token FCM terdaftar", 404);
  } else if (Array.isArray(body?.tokens)) {
    tokens = body.tokens.map((t: unknown) => String(t).trim()).filter(Boolean);
    if (!tokens.length) return fail("tokens kosong", 400);
  } else {
    return fail("isi customer_id atau tokens[]", 400);
  }

  const title = fillTemplate(String(tpl.title), vars);
  const text = fillTemplate(String(tpl.body), vars);
  const results: { token: string; sent: boolean; error?: string }[] = [];
  for (const tok of Array.from(new Set(tokens))) {
    const r = await sendFcm(tok, title, text);
    results.push({ token: tok.slice(0, 12) + "…", sent: r.sent, error: r.error });
    // Bersihkan token yang sudah tidak valid
    if (!r.sent && /not.registered|invalid/i.test(r.error ?? "")) {
      try {
        await db`delete from fcm_tokens where token = ${tok}`;
      } catch {
        /* abaikan */
      }
    }
  }
  return ok({ template: tplName, total: results.length, sent: results.filter((r) => r.sent).length, results });
}

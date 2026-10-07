import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

const COMPANY_FIELDS = [
  "name", "tagline", "address", "phone", "email", "website", "logo_url",
  "primary_color", "secondary_color", "invoice_prefix",
];

export async function GET(_req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const srows = await db`select key, value from settings order by key asc`;
  const settings: Record<string, string> = {};
  for (const r of srows) settings[r.key as string] = r.value as string;
  const crows = await db`select * from company where id = 1`;
  return ok({ settings, company: crows[0] ?? null });
}

export async function PUT(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  if (!body) return fail("Body tidak valid", 400);
  const db = sql();

  if (body.settings && typeof body.settings === "object") {
    for (const [k, v] of Object.entries(body.settings)) {
      await db`insert into settings (key, value) values (${k}, ${String(v ?? "")})
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
    }
  }
  if (body.company && typeof body.company === "object") {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const k of COMPANY_FIELDS) {
      if (body.company[k] !== undefined) {
        values.push(body.company[k] === "" ? null : body.company[k]);
        sets.push(`${k} = $${values.length}`);
      }
    }
    const exists = await db`select id from company where id = 1`;
    if (exists.length) {
      if (sets.length)
        await db.unsafe(`update company set ${sets.join(", ")} where id = 1`, values as never[]);
    } else {
      await db`insert into company (id) values (1) on conflict (id) do nothing`;
      if (sets.length)
        await db.unsafe(`update company set ${sets.join(", ")} where id = 1`, values as never[]);
    }
  }
  return ok({ saved: true });
}

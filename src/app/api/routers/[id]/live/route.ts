import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { connectRouter, getInterfaces, getSystemResource } from "@/lib/routeros";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Data live router: daftar interface + system resource.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const rows = await db`select * from routers where id = ${params.id}`;
  if (!rows.length) return fail("Router tidak ditemukan", 404);
  const r = rows[0] as Record<string, unknown>;
  try {
    const conn = await connectRouter(
      {
        id: Number(r.id),
        host: String(r.host),
        api_port: r.api_port ? Number(r.api_port) : 8728,
        username: String(r.username),
        password_enc: (r.password_enc as string | null) ?? "",
      },
      8000
    );
    try {
      const [interfaces, resource] = await Promise.all([getInterfaces(conn), getSystemResource(conn)]);
      await db`update routers set last_seen_at = now() where id = ${params.id}`;
      return ok({ interfaces, resource });
    } finally {
      conn.close();
    }
  } catch (e) {
    return fail(`Router tidak merespons: ${e instanceof Error ? e.message : "unknown"}`, 502);
  }
}

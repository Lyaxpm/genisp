import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { connectRouter, pppActiveRemove, hotspotActiveRemove } from "@/lib/routeros";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Tendang sesi aktif user (kick): { username, type?: "pppoe" | "hotspot" }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession("router");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const type = body?.type === "hotspot" ? "hotspot" : "pppoe";
  if (!username) return fail("username wajib diisi", 400);
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
      const kicked =
        type === "hotspot" ? await hotspotActiveRemove(conn, username) : await pppActiveRemove(conn, username);
      return ok({ username, type, kicked, message: kicked ? `Sesi "${username}" ditendang` : `Tidak ada sesi aktif untuk "${username}"` });
    } finally {
      conn.close();
    }
  } catch (e) {
    return fail(`Router tidak merespons: ${e instanceof Error ? e.message : "unknown"}`, 502);
  }
}

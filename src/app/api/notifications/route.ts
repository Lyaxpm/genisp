import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status")?.trim() ?? "";
  const channel = sp.get("channel")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (status) {
    params.push(status);
    where += ` and status = $${params.length}`;
  }
  if (channel) {
    params.push(channel);
    where += ` and channel = $${params.length}`;
  }
  const totalRows = await db.unsafe(`select count(*)::int as total from notifications ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select * from notifications ${where} order by id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

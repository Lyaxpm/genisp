import { NextRequest } from "next/server";
import { genieStaff, genieFailure } from "@/lib/genieacs-api";
import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    await genieStaff();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
    const db = sql();
    return ok(await db`select id, code, name from customers where name ilike ${"%" + q + "%"} or code ilike ${"%" + q + "%"} order by name limit 30`);
  } catch (e) { return genieFailure(e); }
}

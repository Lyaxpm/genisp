import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Riwayat mutasi stok
export async function GET(req: NextRequest) {
  const s = await getSession("gudang");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const itemId = sp.get("item_id")?.trim() ?? "";
  const direction = sp.get("direction")?.trim() ?? "";
  const db = sql();
  const params: unknown[] = [];
  let where = "where 1=1";
  if (itemId) {
    params.push(Number(itemId));
    where += ` and sm.item_id = $${params.length}`;
  }
  if (direction === "in" || direction === "out") {
    params.push(direction);
    where += ` and sm.direction = $${params.length}`;
  }
  const rows = await db.unsafe(
    `select sm.*, i.name as item_name, i.unit, u.name as created_by_name from stock_moves sm
     join items i on i.id = sm.item_id
     left join users u on u.id = sm.created_by
     ${where} order by sm.created_at desc limit 200`,
    params as never[]
  );
  return ok({ items: rows });
}

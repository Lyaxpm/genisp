import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const id = Number(params.id);
  if (!Number.isInteger(id)) return fail("ID tidak valid", 400);
  const db = sql();
  await db`delete from map_cables where id = ${id}`;
  return ok({ deleted: id });
}

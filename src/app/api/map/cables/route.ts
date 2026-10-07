import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CablePoint = [number, number];

function validPoints(input: unknown): CablePoint[] | null {
  if (!Array.isArray(input)) return null;
  const pts: CablePoint[] = [];
  for (const p of input) {
    if (
      Array.isArray(p) &&
      p.length === 2 &&
      typeof p[0] === "number" &&
      typeof p[1] === "number" &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1])
    ) {
      pts.push([p[0], p[1]]);
    }
  }
  return pts.length >= 2 ? pts : null;
}

export async function GET() {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const db = sql();
  const cables = await db`select * from map_cables order by id asc`;
  return ok({ cables });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return fail("Nama kabel wajib diisi", 400);
  const pts = validPoints(body?.path);
  if (!pts) return fail("Kabel membutuhkan minimal 2 titik koordinat valid", 400);
  const color = /^#[0-9a-fA-F]{6}$/.test(String(body?.color ?? ""))
    ? String(body.color)
    : "#0d627c";
  const db = sql();
  const row = (
    await db`insert into map_cables (name, color, path, notes)
      values (${name}, ${color}, ${JSON.stringify(pts)}::jsonb, ${body?.notes ? String(body.notes) : null})
      returning *`
  )[0];
  return ok({ cable: row }, 201);
}

import { NextRequest } from "next/server";
import { genieStaff, genieFailure } from "@/lib/genieacs-api";
import { listDevices, GenieError } from "@/lib/genieacs";
import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    await genieStaff();
    const query = req.nextUrl.searchParams;
    const search = (query.get("q") ?? "").trim();
    if (search.length > 100) throw new GenieError("Pencarian maksimal 100 karakter", 400);
    const page = Math.max(1, Math.min(10000, parseInt(query.get("page") ?? "1", 10) || 1));
    const limit = Math.max(1, Math.min(100, parseInt(query.get("limit") ?? "20", 10) || 20));
    const data = await listDevices(search, page, limit);
    const ids = data.items.map(d => d.id);
    const links = ids.length ? await sql()`select l.device_id, c.id as customer_id, c.name as customer_name, c.code as customer_code
      from genieacs_links l join customers c on c.id = l.customer_id where l.device_id = any(${ids})` : [];
    return ok({ ...data, items: data.items.map(d => ({ ...d, customer: links.find(l => l.device_id === d.id) ?? null })) });
  } catch (e) { return genieFailure(e); }
}

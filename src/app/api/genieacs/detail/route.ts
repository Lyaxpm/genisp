import { NextRequest } from "next/server";
import { genieStaff, genieFailure, deviceId } from "@/lib/genieacs-api";
import { getDevice, normalizeDevice, genieRequest } from "@/lib/genieacs";
import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    await genieStaff();
    const id = deviceId(req.nextUrl.searchParams.get("device_id"));
    const raw = await getDevice(id);
    const tasks = await genieRequest(`tasks/?${new URLSearchParams({ query: JSON.stringify({ device: id }), projection: "_id,name,timestamp", limit: "50" })}`);
    const db = sql();
    const [customer] = await db`select c.id as customer_id, c.name as customer_name, c.code as customer_code
      from genieacs_links l join customers c on c.id = l.customer_id where l.device_id = ${id}`;
    const history = await db`select id, action, status, task_id, created_at from genieacs_actions where device_id = ${id} order by id desc limit 20`;
    return ok({ device: normalizeDevice(raw), customer: customer ?? null,
      tasks: Array.isArray(tasks.data) ? tasks.data.map(t => ({ id: t._id, name: t.name, timestamp: t.timestamp })) : [], history });
  } catch (e) { return genieFailure(e); }
}

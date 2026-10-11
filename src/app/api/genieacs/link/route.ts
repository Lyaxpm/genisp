import { NextRequest } from "next/server";
import { genieStaff, genieFailure, deviceId } from "@/lib/genieacs-api";
import { getDevice, GenieError } from "@/lib/genieacs";
import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";
export const dynamic = "force-dynamic";
export async function PUT(req: NextRequest) {
  try {
    const user = await genieStaff();
    const body = await req.json().catch(() => null);
    const id = deviceId(body?.device_id);
    const customerId = body?.customer_id;
    if (customerId !== null && (!Number.isSafeInteger(customerId) || customerId <= 0)) throw new GenieError("Pelanggan tidak valid", 400);
    await getDevice(id);
    const db = sql();
    await db.begin(async tx => {
      if (customerId === null) await tx`delete from genieacs_links where device_id = ${id}`;
      else {
        const [customer] = await tx`select id from customers where id = ${customerId}`;
        if (!customer) throw new GenieError("Pelanggan tidak ditemukan", 404);
        await tx`insert into genieacs_links (device_id, customer_id, updated_by) values (${id}, ${customerId}, ${user.id})
          on conflict (device_id) do update set customer_id = excluded.customer_id, updated_by = excluded.updated_by, updated_at = now()`;
      }
      await tx`insert into genieacs_actions (device_id, action, status, created_by) values (${id}, ${customerId === null ? "unlink" : "link"}, 'completed', ${user.id})`;
    });
    return ok({ saved: true });
  } catch (e) { return genieFailure(e); }
}

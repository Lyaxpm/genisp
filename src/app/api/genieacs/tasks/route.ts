import { NextRequest } from "next/server";
import { genieStaff, genieFailure, deviceId } from "@/lib/genieacs-api";
import { getDevice, wifiTask, enqueueTask, GenieError } from "@/lib/genieacs";
import { sql } from "@/lib/db";
import { ok } from "@/lib/utils";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const user = await genieStaff();
    const body = await req.json().catch(() => null);
    const id = deviceId(body?.device_id);
    if (!["refresh", "reboot", "wifi"].includes(body?.action)) throw new GenieError("Aksi tidak didukung", 400);
    const raw = await getDevice(id);
    const task = body.action === "wifi" ? wifiTask(raw, { path: String(body.path ?? ""), ssid: String(body.ssid ?? ""), password: body.password ? String(body.password) : undefined })
      : body.action === "reboot" ? { name: "reboot" } : { name: "refreshObject", objectName: "" };
    const db = sql();
    const [audit] = await db`insert into genieacs_actions (device_id, action, status, created_by) values (${id}, ${body.action}, 'sending', ${user.id}) returning id`;
    let result;
    try { result = await enqueueTask(id, task); }
    catch (e) {
      try { await db`update genieacs_actions set status = 'unknown' where id = ${audit.id}`; } catch { /* Preserve original uncertainty. */ }
      throw e;
    }
    let auditRecorded = true;
    try { await db`update genieacs_actions set status = ${result.status}, task_id = ${result.taskId || null} where id = ${audit.id}`; }
    catch { auditRecorded = false; }
    return ok({ ...result, auditRecorded }, result.status === "queued" ? 202 : 200);
  } catch (e) { return genieFailure(e); }
}

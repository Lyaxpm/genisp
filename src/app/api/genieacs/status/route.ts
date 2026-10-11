import { genieStaff, genieFailure } from "@/lib/genieacs-api";
import { genieRequest } from "@/lib/genieacs";
import { ok } from "@/lib/utils";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await genieStaff();
    const started = Date.now();
    await genieRequest("devices/?limit=1&projection=_id");
    return ok({ connected: true, latencyMs: Date.now() - started });
  } catch (e) { return genieFailure(e); }
}

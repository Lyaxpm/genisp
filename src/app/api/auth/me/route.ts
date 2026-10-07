import { getSession } from "@/lib/auth";
import { ok, fail } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return fail("Unauthorized", 401);
  return ok({ user: s });
}

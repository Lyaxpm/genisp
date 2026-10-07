import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSessionCookie();
  return ok({ message: "Berhasil logout" });
}

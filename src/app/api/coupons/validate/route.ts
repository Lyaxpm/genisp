import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { validateCoupon } from "@/lib/coupons";
import { ok, fail, rupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** POST {code, amount} → {valid, discount, message}. Dipakai saat checkout. */
export async function POST(req: NextRequest) {
  const s = await getSession("tagihan");
  if (!s || (s.kind !== "staff" && s.kind !== "member")) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "");
  const amount = Number(body?.amount ?? 0);
  if (amount < 0) return fail("Nominal tidak valid", 400);

  const db = sql();
  const check = await validateCoupon(db, code, amount);
  if (!check.valid) return fail(check.message, 400);
  return ok({
    valid: true,
    discount: check.discount,
    message: `Kupon ${check.coupon!.code} — hemat ${rupiah(check.discount)}`,
    coupon: {
      code: check.coupon!.code,
      discount_type: check.coupon!.discount_type,
      discount_value: Number(check.coupon!.discount_value),
    },
  });
}

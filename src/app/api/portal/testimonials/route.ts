import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/utils";
import { requireMemberService, logMemberActivity } from "@/lib/portal-service";

export const dynamic = "force-dynamic";

// Kirim testimoni milik member yang login. Status awal "pending" (menunggu moderasi staff).
// Batas: 1 testimoni per 24 jam per pelanggan.
export async function POST(req: NextRequest) {
  const r = await requireMemberService(req);
  if ("error" in r) return r.error;
  const { db, cust, ip } = r.ctx;

  const body = await req.json().catch(() => null);
  const rating = Number(body?.rating);
  const message = String(body?.message ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return fail("Rating harus 1-5", 400);
  if (message.length < 10 || message.length > 1000)
    return fail("Testimoni harus 10-1000 karakter", 400);

  const recent = (
    await db`select 1 from testimonials
      where customer_id = ${cust.id} and created_at > now() - interval '24 hours' limit 1`
  ).length > 0;
  if (recent) return fail("Anda sudah mengirim testimoni dalam 24 jam terakhir", 429);

  const ins = (
    await db`insert into testimonials (customer_id, rating, message, status)
      values (${cust.id}, ${rating}, ${message}, 'pending')
      returning id, rating, status, created_at`
  )[0];

  await logMemberActivity(
    db,
    cust,
    "portal:testimonial",
    `kirim testimoni id=${ins.id} rating=${rating}`,
    ip
  );

  return ok(
    { testimonial: ins, note: "Terima kasih! Testimoni Anda menunggu moderasi sebelum ditampilkan." },
    201
  );
}

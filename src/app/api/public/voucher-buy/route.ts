import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { ok, fail, randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Beli voucher publik: buat voucher aktif + instruksi bayar manual.
// (Rekonsiliasi pembayaran dilakukan staff via menu Konfirmasi / WhatsApp.)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const packageId = Number(body?.package_id);
  if (!Number.isInteger(packageId)) return fail("Paket tidak valid", 400);

  const db = sql();
  const pkg = (
    await db`select id, name, price, duration_hours, description
      from hotspot_packages where id = ${packageId} and is_active = true`
  )[0];
  if (!pkg) return fail("Paket voucher tidak ditemukan", 404);

  const router = (
    await db`select id from routers where is_active = true order by id asc limit 1`
  )[0] ?? null;

  // Kode unik, coba hingga 5x bila tabrakan.
  let code = "";
  for (let i = 0; i < 5; i++) {
    const cand = randomCode(8);
    const exists = (
      await db`select 1 from vouchers where code = ${cand} limit 1`
    ).length > 0;
    if (!exists) {
      code = cand;
      break;
    }
  }
  if (!code) return fail("Gagal membuat kode voucher, coba lagi", 500);

  const buyerName = String(body?.buyer_name ?? "").trim() || null;
  const buyerPhone = String(body?.buyer_phone ?? "").trim() || null;

  const voucher = (
    await db`insert into vouchers (code, hotspot_package_id, router_id, status)
      values (${code}, ${pkg.id}, ${router?.id ?? null}, 'active') returning *`
  )[0];

  const company = (await db`select name, phone from company where id = 1`)[0] ?? null;

  return ok(
    {
      voucher: {
        code: voucher.code,
        package_name: pkg.name,
        price: pkg.price,
        duration_hours: pkg.duration_hours,
      },
      buyer: { name: buyerName, phone: buyerPhone },
      payment_instruction:
        `Lakukan pembayaran ${pkg.price > 0 ? "sebesar " + Number(pkg.price).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }) : ""} ` +
        `ke ${company?.name ?? "kami"}${company?.phone ? " (" + company.phone + ")" : ""}, ` +
        `lalu konfirmasi via WhatsApp dengan menyertakan kode voucher ${voucher.code}. ` +
        `Voucher berlaku ${pkg.duration_hours} jam sejak pertama dipakai.`,
    },
    201
  );
}

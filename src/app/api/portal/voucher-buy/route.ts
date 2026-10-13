import { NextRequest } from "next/server";
import { ok, fail, randomCode, rupiah } from "@/lib/utils";
import { requireMemberService, logMemberActivity } from "@/lib/portal-service";
import { getOrCreateWallet, debitWallet } from "@/lib/wallet";
import { pushVoucherToRouter } from "@/lib/mikrotik-actions";

export const dynamic = "force-dynamic";

// Beli voucher hotspot pakai saldo wallet milik member yang login.
// Saldo didebit atomik via wallet.ts + ledger; kredensial voucher
// dikembalikan SEKALI di respons ini (tidak ada endpoint baca ulang).
// Push ke router best-effort (bagian RouterOS: UNTESTED-live).
export async function POST(req: NextRequest) {
  const r = await requireMemberService(req);
  if ("error" in r) return r.error;
  const { db, cust, ip } = r.ctx;

  const body = await req.json().catch(() => null);
  const packageId = Number(body?.package_id);
  if (!Number.isInteger(packageId)) return fail("Paket voucher tidak valid", 400);

  const pkg = (
    await db`select id, name, price, duration_hours, profile, description
      from hotspot_packages where id = ${packageId} and is_active = true`
  )[0];
  if (!pkg) return fail("Paket voucher tidak ditemukan", 404);
  const price = Number(pkg.price ?? 0);

  const wallet = await getOrCreateWallet(db, "customer", cust.id);
  if (price > 0 && Number(wallet.balance) < price)
    return fail(`Saldo wallet tidak mencukupi (butuh ${rupiah(price)})`, 402);

  // Router: pakai router pelanggan bila ada, fallback router aktif pertama.
  const router =
    (cust.router_id
      ? await db`select id from routers where id = ${cust.router_id}`
      : []
    )[0] ??
    (await db`select id from routers where is_active = true order by id asc limit 1`)[0] ??
    null;

  // Kode unik, coba hingga 5x bila tabrakan.
  let code = "";
  for (let i = 0; i < 5; i++) {
    const cand = randomCode(8);
    const exists = (await db`select 1 from vouchers where code = ${cand} limit 1`).length > 0;
    if (!exists) {
      code = cand;
      break;
    }
  }
  if (!code) return fail("Gagal membuat kode voucher, coba lagi", 500);

  const voucher = (
    await db`insert into vouchers (code, hotspot_package_id, router_id, status)
      values (${code}, ${pkg.id}, ${router?.id ?? null}, 'active') returning id, code`
  )[0];

  if (price > 0) {
    try {
      await debitWallet(
        db,
        Number(wallet.id),
        price,
        "voucher",
        Number(voucher.id),
        `Beli voucher hotspot ${pkg.name} (${code}) via portal member`
      );
    } catch (e) {
      // Batalkan voucher agar tidak yatim.
      await db`delete from vouchers where id = ${voucher.id}`;
      return fail(e instanceof Error ? e.message : "Gagal mendebit wallet", 402);
    }
  }

  let routerNote = "Voucher belum didorong ke router (tidak ada router terpasang).";
  if (router?.id) {
    const push = await pushVoucherToRouter(db, Number(voucher.id));
    routerNote =
      push.router === "ok"
        ? `Voucher terkirim ke router (${push.detail}).`
        : `Catatan: ${push.detail}. Voucher tetap valid dan bisa dipakai.`;
  }

  await logMemberActivity(
    db,
    cust,
    "portal:voucher-buy",
    `beli voucher ${pkg.name} kode ${code} seharga ${rupiah(price)}`,
    ip
  );

  return ok(
    {
      voucher: {
        code: voucher.code,
        package_name: pkg.name,
        duration_hours: pkg.duration_hours,
        price,
      },
      router_note: routerNote,
      warning: "Simpan kode ini sekarang — kredensial hanya ditampilkan sekali.",
    },
    201
  );
}

import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getOrCreateWallet, debitWallet, creditWallet } from "@/lib/wallet";
import { ok, fail, randomCode } from "@/lib/utils";
import { connectRouter, findId, hotspotUserAdd } from "@/lib/routeros";

export const dynamic = "force-dynamic";

type CreatedVoucher = { username: string; password: string; profile: string };
type FailedVoucher = { code: string; detail: string };

// POST: reseller (atau staff atas nama reseller) membeli voucher hotspot.
// 1) Potong wallet reseller dulu (reseller_price per paket).
// 2) Buat voucher langsung di MikroTik sebagai hotspot user — kredensial TIDAK disimpan di DB,
//    hanya dikembalikan sekali di response untuk dicetak via /templates/[id]/print.
// 3) Bila pembuatan di MikroTik GAGAL → refund otomatis via ledger wallet (credit), bukan manipulasi angka.
// UNTESTED-live: butuh router fisik untuk verifikasi.
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const packageId = Number(body?.package_id);
  const routerId = Number(body?.router_id);
  const qty = Math.min(500, Math.max(1, Number(body?.qty) || 1));
  if (!packageId) return fail("package_id wajib diisi", 400);
  if (!routerId) return fail("router_id wajib diisi (voucher hanya hidup di MikroTik)", 400);

  // Reseller mana yang membayar: dari sesi partner, atau staff via partner_id.
  let resellerId: number | null = null;
  if (s.kind === "partner") resellerId = s.id;
  else if (s.kind === "staff" && body?.partner_id) resellerId = Number(body.partner_id);
  if (!resellerId) return fail("partner_id wajib diisi", 400);

  const db = sql();
  const pkgRows = await db`select id, name, profile, duration_hours, reseller_price, customer_price, price
    from hotspot_packages where id = ${packageId}`;
  if (!pkgRows.length) return fail("Paket hotspot tidak ditemukan", 404);
  const pkg = pkgRows[0] as Record<string, unknown>;
  const rRows = await db`select id, host, api_port, username, password_enc, is_active
    from routers where id = ${routerId}`;
  if (!rRows.length || !(rRows[0] as Record<string, unknown>).is_active)
    return fail("Router tidak ditemukan / tidak aktif", 404);
  const router = rRows[0] as Record<string, unknown>;

  const unitPrice = Number(pkg.reseller_price ?? pkg.customer_price ?? pkg.price ?? 0);
  const total = unitPrice * qty;
  const wallet = await getOrCreateWallet(db, "partner", resellerId);

  // 1) Debit wallet reseller dulu.
  let debited = 0;
  if (total > 0) {
    try {
      await debitWallet(
        db, wallet.id, total, "voucher_purchase", undefined,
        `Beli ${qty} voucher hotspot "${String(pkg.name)}"`, s.id
      );
      debited = total;
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Saldo wallet reseller tidak cukup", 400);
    }
  }

  // 2) Buat voucher langsung di MikroTik.
  const created: CreatedVoucher[] = [];
  const failed: FailedVoucher[] = [];
  const profile = pkg.profile ? String(pkg.profile) : undefined;
  const hours = Number(pkg.duration_hours ?? 24);
  const limitUptime = `${hours}:00:00`;

  try {
    const conn = await connectRouter({
      id: routerId,
      host: String(router.host),
      api_port: router.api_port ? Number(router.api_port) : 8728,
      username: String(router.username ?? ""),
      password_enc: String(router.password_enc ?? ""),
    });
    try {
      for (let i = 0; i < qty; i++) {
        let code = "";
        let guard = 0;
        while (guard < 10) {
          guard++;
          code = randomCode(8);
          const exists = await findId(conn, "/ip/hotspot/user", "name", code);
          if (!exists) break;
        }
        if (!code) {
          failed.push({ code: "", detail: "gagal membuat kode unik" });
          continue;
        }
        try {
          const exists = await findId(conn, "/ip/hotspot/user", "name", code);
          if (!exists) {
            await hotspotUserAdd(conn, {
              name: code,
              password: code,
              profile,
              limitUptime,
              comment: `voucher-genisp:${code}`,
            });
          }
          created.push({ username: code, password: code, profile: profile ?? "" });
        } catch (e) {
          failed.push({ code, detail: e instanceof Error ? e.message : "gagal push ke router" });
        }
      }
    } finally {
      conn.close();
    }
  } catch (e) {
    failed.push({
      code: "",
      detail: `koneksi router gagal: ${e instanceof Error ? e.message : "unknown"} (${qty - created.length} voucher belum dibuat)`,
    });
  }

  // 3) Refund otomatis via ledger untuk voucher yang gagal dibuat di MikroTik.
  //    created.length sukses → hanya yang gagal yang direfund.
  const failedCount = qty - created.length;
  let refunded = 0;
  if (debited > 0 && failedCount > 0) {
    const refundAmount = Math.round((unitPrice * failedCount) * 100) / 100;
    try {
      await creditWallet(
        db, wallet.id, refundAmount, "voucher_refund", undefined,
        `Refund otomatis: ${failedCount} voucher hotspot gagal dibuat di MikroTik`, s.id
      );
      refunded = refundAmount;
    } catch (e) {
      // Refund gagal = kondisi kritis; laporkan eksplisit agar admin menindaklanjuti manual.
      return ok({
        created, failed, failed_count: failedCount,
        paid: debited, refunded: 0,
        refund_error: e instanceof Error ? e.message : "refund gagal — hubungi admin",
        note: "SEBAGIAN voucher gagal dan refund otomatis GAGAL. Catat failed_count untuk refund manual.",
      });
    }
  }

  await db`insert into activity_logs (action, detail)
    values ('reseller-voucher-purchase',
      ${`reseller=${resellerId} package=${packageId} qty=${qty} ok=${created.length} fail=${failedCount} paid=${debited} refund=${refunded}`})`.catch(() => null);

  return ok(
    {
      created,            // kredensial tampil sekali di sini; tidak disimpan di DB
      failed,
      failed_count: failedCount,
      paid: debited,
      refunded,
      print_hint: "Kirim created[] ke GET /api/hotspot/templates/[id]/print?data=... untuk cetak",
      note: "UNTESTED-live: verifikasi butuh router fisik.",
    },
    201
  );
}

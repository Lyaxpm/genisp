import { NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pushVoucherToRouter } from "@/lib/mikrotik-actions";
import { getOrCreateWallet, debitWallet } from "@/lib/wallet";
import { ok, fail, randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const s = await getSession("hotspot");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const status = sp.get("status")?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
  const offset = (page - 1) * limit;
  const db = sql();

  const params: unknown[] = [];
  let where = "where 1=1";
  if (q) {
    params.push(`%${q}%`);
    where += ` and v.code ilike $${params.length}`;
  }
  if (status) {
    params.push(status);
    where += ` and v.status = $${params.length}`;
  }
  const from = "vouchers v left join hotspot_packages hp on hp.id = v.hotspot_package_id";
  const totalRows = await db.unsafe(`select count(*)::int as total from ${from} ${where}`, params as never[]);
  params.push(limit, offset);
  const items = await db.unsafe(
    `select v.*, hp.name as package_name from ${from} ${where}
     order by v.id desc limit $${params.length - 1} offset $${params.length}`,
    params as never[]
  );
  return ok({ items, total: totalRows[0].total as number, page, limit });
}

export async function POST(req: NextRequest) {
  const s = await getSession("hotspot");
  if (!s || s.kind !== "staff") return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const package_id = Number(body?.package_id);
  const router_id = body?.router_id ? Number(body.router_id) : null;
  const qty = Number(body?.qty ?? 1);
  if (!Number.isInteger(qty) || qty < 1 || qty > 500) return fail("Jumlah voucher harus 1–500", 400);
  if (!package_id) return fail("package_id wajib diisi", 400);
  const db = sql();
  const pkg = await db`select id, customer_price, reseller_price from hotspot_packages where id = ${package_id}`;
  if (!pkg.length) return fail("Paket hotspot tidak ditemukan", 404);

  let walletNote: string | null = null;
  let created;
  try {
    created = await db.begin(async tx => {
      const partnerId = body?.partner_id ? Number(body.partner_id) : null;
      if (partnerId) {
        const [partner] = await tx`select id from partners where id = ${partnerId} and is_active = true`;
        if (!partner) throw new Error("Reseller tidak ditemukan atau nonaktif");
        const total = Number(pkg[0].reseller_price ?? pkg[0].customer_price ?? 0) * qty;
        if (total > 0) {
          const w = await getOrCreateWallet(tx, "partner", partnerId);
          await debitWallet(tx, w.id, total, "voucher_purchase", undefined, `Beli ${qty} voucher hotspot`, s.id);
          walletNote = `Wallet reseller terdebit Rp ${total.toLocaleString("id-ID")}`;
        }
      }
      const vouchers = [];
      for (let guard = 0; vouchers.length < qty && guard < qty * 10; guard++) {
        const rows = await tx`insert into vouchers (code, hotspot_package_id, router_id, created_by)
          values (${randomCode(8)}, ${package_id}, ${router_id}, ${s.id}) on conflict (code) do nothing returning *`;
        if (rows.length) vouchers.push(rows[0]);
      }
      if (vouchers.length !== qty) throw new Error("Gagal membuat semua voucher; saldo tidak dipotong");
      return vouchers;
    });
  } catch (e) { return fail(e instanceof Error ? e.message : "Generate gagal", 400); }
  // Dorong voucher ke router sebagai hotspot user (best-effort, tidak menggagalkan generate).
  const pushed: Array<{ code: string; ok: boolean; detail: string }> = [];
  for (const v of created) {
    const vid = Number((v as Record<string, unknown>).id);
    const vcode = String((v as Record<string, unknown>).code);
    const vrouter = (v as Record<string, unknown>).router_id;
    if (!vrouter) {
      pushed.push({ code: vcode, ok: false, detail: "tanpa router (hanya tersimpan di DB)" });
      continue;
    }
    try {
      const res = await pushVoucherToRouter(db, vid);
      pushed.push({ code: vcode, ok: res.ok, detail: res.detail });
    } catch (e) {
      pushed.push({ code: vcode, ok: false, detail: e instanceof Error ? e.message : "gagal" });
    }
  }
  return ok({ generated: created.length, vouchers: created, pushed, wallet: walletNote }, 201);
}

import { NextRequest } from "next/server";
import { sql, type Sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  createXenditInvoice,
  createMidtransTransaction,
  createTripayTransaction,
  createDuitkuInvoice,
  createIpaymuPayment,
  createBniVA,
} from "@/lib/gateways";
import { validateCoupon, consumeCoupon, type CouponRow } from "@/lib/coupons";
import { settleInTransaction, sendSettlementNotice, type PaymentRow } from "@/lib/settle";
import { ok, fail, randomCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GATEWAYS = [
  "manual",
  "xendit",
  "midtrans",
  "tripay",
  "duitku",
  "doku",
  "ipaymu",
  "bni",
  "moota",
  "wallet",
];

async function getSetting(db: Sql, key: string): Promise<string> {
  const rows = await db`select value from settings where key = ${key}`;
  return (rows[0]?.value as string) ?? "";
}

export async function POST(req: NextRequest) {
  const s = await getSession("tagihan");
  if (!s || (s.kind !== "staff" && s.kind !== "member")) return fail("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const invoice_id = Number(body?.invoice_id);
  const gateway = String(body?.gateway ?? "manual");
  const coupon_code = String(body?.coupon_code ?? "").trim();
  if (!invoice_id) return fail("invoice_id wajib diisi", 400);
  if (!GATEWAYS.includes(gateway)) return fail("Gateway tidak valid", 400);
  if (gateway === "wallet" && s.kind !== "member")
    return fail("Pembayaran wallet hanya untuk member", 403);

  const db = sql();
  const rows = await db`select i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
    from invoices i join customers c on c.id = i.customer_id where i.id = ${invoice_id}`;
  if (!rows.length) return fail("Invoice tidak ditemukan", 404);
  const invoice = rows[0] as {
    id: number;
    code: string;
    amount: number | string;
    status: string;
    customer_id: number;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
  };
  if (s.kind === "member" && invoice.customer_id !== s.id) return fail("Akses ditolak", 403);
  if (invoice.status === "paid") return fail("Invoice sudah lunas", 400);

  // ---- Kupon ----
  const subtotal = Math.round(Number(invoice.amount));
  let discount = 0;
  let coupon: CouponRow | null = null;
  if (coupon_code) {
    const check = await validateCoupon(db, coupon_code, subtotal);
    if (!check.valid) return fail(check.message, 400);
    discount = check.discount;
    coupon = check.coupon;
  }

  // ---- PPN ----
  const ppnPercent = Number((await getSetting(db, "ppn_percent")) || "0");
  const afterDiscount = subtotal - discount;
  const ppn = Math.round((afterDiscount * ppnPercent) / 100);
  const total = afterDiscount + ppn;

  const externalId = `GENISP-${invoice.id}-${Date.now()}-${randomCode(6)}`;
  const rawBreakdown = {
    subtotal,
    discount,
    coupon_code: coupon_code ? coupon_code.toUpperCase() : null,
    coupon_id: coupon?.id ?? null,
    ppn_percent: ppnPercent,
    ppn,
    total,
  };

  if (!Number.isFinite(total) || total < 0) return fail("Total pembayaran tidak valid", 400);
  let checkout;
  try {
    checkout = await db.begin(async tx => {
      const [current] = await tx`select status, amount, customer_id from invoices where id = ${invoice.id} for update`;
      if (!current || current.status === "paid" || current.status === "cancelled") throw new Error("Invoice sudah lunas atau dibatalkan");
      if (Number(current.amount) !== Number(invoice.amount) || Number(current.customer_id) !== Number(invoice.customer_id)) throw new Error("Tagihan berubah. Muat ulang sebelum membayar.");
      const [payment] = await tx`insert into payments (invoice_id, gateway, external_id, amount, status, raw)
        values (${invoice.id}, ${gateway}, ${externalId}, ${total}, 'pending', ${JSON.stringify(rawBreakdown)}::jsonb) returning *`;
      if (coupon) await consumeCoupon(tx, coupon, discount, invoice.id, invoice.customer_id);
      const settlement = gateway === "wallet" ? await settleInTransaction(tx, Number(payment.id)) : null;
      return { payment: payment as unknown as PaymentRow, settlement };
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Pembayaran gagal", 400);
  }
  const payRow = checkout.payment;
  if (checkout.settlement) {
    await sendSettlementNotice(db, checkout.settlement);
    return ok({ wallet: true, settled: !checkout.settlement.already,
      payment: checkout.settlement.payment ?? payRow, breakdown: rawBreakdown });
  }

  const instruction =
    (await getSetting(db, "payment_instruction")) ||
    "Silakan transfer ke rekening resmi perusahaan, lalu konfirmasi pembayaran melalui halaman Konfirmasi Pembayaran.";

  if (gateway === "manual") {
    return ok({ manual: true, instruction, payment: payRow, breakdown: rawBreakdown });
  }

  // Doku O2O / Moota: instruksional (tanpa API create) — payment tercatat pending,
  // pelunasan via webhook Doku / pencocokan mutasi Moota.
  if (gateway === "doku") {
    const retailCode = "DOKU" + randomCode(10);
    await db.unsafe(`update payments set raw = raw || $1::jsonb where id = $2`, [
      JSON.stringify({ retail_code: retailCode }),
      payRow.id,
    ] as never[]);
    return ok({
      manual: true,
      instruction:
        `Tunjukkan kode ${retailCode} di kasir Alfamart/Indomaret dan bayar tepat sebesar Rp ${total.toLocaleString("id-ID")}. ` +
        "Status lunas otomatis setelah pembayaran terverifikasi Doku.",
      payment: payRow,
      breakdown: rawBreakdown,
      retail_code: retailCode,
    });
  }

  if (gateway === "moota") {
    const bankAcc = (await getSetting(db, "bank_account_info")) || "rekening resmi perusahaan";
    return ok({
      manual: true,
      instruction:
        `Transfer TEPAT sebesar Rp ${total.toLocaleString("id-ID")} ke ${bankAcc}. ` +
        "Sistem otomatis memverifikasi mutasi bank (maks. beberapa menit) dan melunasi invoice Anda.",
      payment: payRow,
      breakdown: rawBreakdown,
    });
  }

  try {
    let result: unknown;
    if (gateway === "xendit") {
      result = await createXenditInvoice({
        externalId,
        amount: total,
        description: `Pembayaran ${invoice.code}`,
        payerEmail: invoice.customer_email ?? undefined,
      });
    } else if (gateway === "midtrans") {
      result = await createMidtransTransaction({
        orderId: externalId,
        amount: total,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email ?? undefined,
        customerPhone: invoice.customer_phone ?? undefined,
      });
    } else if (gateway === "tripay") {
      result = await createTripayTransaction({
        merchantRef: externalId,
        amount: total,
        customerName: invoice.customer_name,
        customerEmail: invoice.customer_email ?? undefined,
        customerPhone: invoice.customer_phone ?? undefined,
      });
    } else if (gateway === "duitku") {
      result = await createDuitkuInvoice({
        merchantOrderId: externalId,
        amount: total,
        productDetails: `Pembayaran ${invoice.code}`,
        customerVaName: invoice.customer_name,
        customerEmail: invoice.customer_email ?? undefined,
        customerPhone: invoice.customer_phone ?? undefined,
      });
    } else if (gateway === "ipaymu") {
      result = await createIpaymuPayment({
        amount: total,
        buyerName: invoice.customer_name,
        buyerPhone: invoice.customer_phone ?? undefined,
        buyerEmail: invoice.customer_email ?? undefined,
        referenceId: externalId,
      });
    } else {
      // bni
      const va = await createBniVA({
        customerName: invoice.customer_name,
        amount: total,
        trxId: externalId,
        invoiceId: invoice.id,
      });
      result = {
        va_number: va.vaNumber,
        expired_at: va.expiredAt,
        instructions: [
          `Transfer tepat sebesar Rp ${total.toLocaleString("id-ID")} ke BNI Virtual Account ${va.vaNumber}.`,
          `Berlaku hingga ${new Date(va.expiredAt).toLocaleString("id-ID")}.`,
        ],
      };
    }
    await db.unsafe(`update payments set raw = raw || $1::jsonb where id = $2`, [
      JSON.stringify({ checkout: result }),
      payRow.id,
    ] as never[]);
    return ok({ payment: payRow, checkout: result, breakdown: rawBreakdown });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return ok({ manual: true, instruction: `${msg}. ${instruction}`, payment: payRow, breakdown: rawBreakdown });
  }
}

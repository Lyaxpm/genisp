import type { Sql } from "./db";

export type CouponRow = {
  id: number;
  code: string;
  discount_type: string; // percent|fixed
  discount_value: number | string;
  max_use: number;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
};

export type CouponCheck = {
  valid: boolean;
  message: string;
  discount: number;
  coupon: CouponRow | null;
};

/** Validasi kupon: aktif, belum kedaluwarsa, kuota masih ada. */
export async function validateCoupon(db: Sql, code: string, amount: number): Promise<CouponCheck> {
  const clean = code.trim().toUpperCase();
  if (!clean) return { valid: false, message: "Kode kupon wajib diisi", discount: 0, coupon: null };
  const rows = await db`select * from coupons where code = ${clean}`;
  const c = rows[0] as unknown as CouponRow | undefined;
  if (!c) return { valid: false, message: "Kupon tidak ditemukan", discount: 0, coupon: null };
  if (!c.is_active) return { valid: false, message: "Kupon sudah tidak aktif", discount: 0, coupon: c };
  if (c.valid_until) {
    const today = new Date().toISOString().slice(0, 10);
    if (String(c.valid_until).slice(0, 10) < today)
      return { valid: false, message: "Kupon sudah kedaluwarsa", discount: 0, coupon: c };
  }
  if (Number(c.used_count) >= Number(c.max_use))
    return { valid: false, message: "Kuota kupon sudah habis", discount: 0, coupon: c };
  const value = Number(c.discount_value);
  let discount = c.discount_type === "percent" ? (amount * value) / 100 : value;
  discount = Math.max(0, Math.min(Math.round(discount), Math.round(amount)));
  return { valid: true, message: "Kupon valid", discount, coupon: c };
}

/** Catat pemakaian kupon (dipanggil saat payment dibuat). */
export async function consumeCoupon(
  db: Sql,
  coupon: CouponRow,
  discount: number,
  invoiceId: number,
  customerId: number | null
): Promise<void> {
  await db`insert into coupon_usages (coupon_id, invoice_id, customer_id, discount)
    values (${coupon.id}, ${invoiceId}, ${customerId}, ${discount})`;
  await db`update coupons set used_count = used_count + 1 where id = ${coupon.id}`;
}

// Tipe data + helper murni untuk area publik/portal.
// File ini TIDAK pakai "use client" sehingga aman diimpor server component.

export type Company = {
  name: string;
  tagline?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
};

export type Pkg = {
  id: number | string;
  name: string;
  category?: string;
  price: number | string;
  speed_down?: string;
  speed_up?: string;
  description?: string;
};

export type Promo = {
  id: number | string;
  title: string;
  description?: string;
  image_url?: string;
  valid_until?: string;
};

export type Service = {
  id: number | string;
  title: string;
  description?: string;
  icon?: string;
};

export type Coverage = {
  id: number | string;
  name: string;
  description?: string;
};

export type Slide = {
  id: number | string;
  title?: string;
  subtitle?: string;
  image_url?: string;
  link_url?: string;
};

export type Invoice = {
  id: number | string;
  code: string;
  period?: string;
  amount: number | string;
  unique_amount?: number | string;
  status: string;
  due_date?: string;
  paid_at?: string;
  payment_method?: string;
  customer_name?: string;
  customer_code?: string;
  package_name?: string;
};

export type Customer = {
  id: number | string;
  code?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  package_name?: string;
  package_id?: number | string;
  due_day?: number;
};

export type PartnerInfo = {
  id: number | string;
  name: string;
  email?: string;
  phone?: string;
  commission_percent?: number | string;
  wallet_balance?: number | string;
};

export type WalletTx = {
  id: number | string;
  type: string;
  amount: number | string;
  description?: string;
  created_at?: string;
};

export function idr(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  if (Number.isNaN(v)) return "Rp 0";
  return "Rp " + v.toLocaleString("id-ID");
}

export function dateID(d?: string | null): string {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function periodLabel(p?: string | null): string {
  if (!p) return "-";
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function invoiceTotal(inv: Invoice): number {
  return Number(inv.amount ?? 0) + Number(inv.unique_amount ?? 0);
}

export function asInvoices(d: unknown): Invoice[] {
  if (!d) return [];
  if (Array.isArray(d)) return d as Invoice[];
  const o = d as Record<string, unknown>;
  if (Array.isArray(o.invoices)) return o.invoices as Invoice[];
  return [];
}

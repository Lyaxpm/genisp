// Kontrak menu untuk RBAC granular.
// Dipakai: API /api/roles/*, middleware, dan sidebar dashboard.

export const MENU_KEYS = [
  "dashboard",
  "pelanggan",
  "tagihan",
  "paket",
  "router",
  "hotspot",
  "ftth",
  "keuangan",
  "tiket",
  "gudang",
  "laporan",
  "notifikasi",
  "pengaturan",
  "pengguna",
  "sales",
  "wallet",
  "master",
  "peta",
  "sistem",
  "konfirmasi",
] as const;

export type MenuKey = (typeof MENU_KEYS)[number];

export const MENU_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pelanggan: "Pelanggan",
  tagihan: "Tagihan",
  paket: "Paket Internet",
  router: "Router",
  hotspot: "Hotspot",
  ftth: "FTTH",
  keuangan: "Keuangan",
  tiket: "Tiket Bantuan",
  gudang: "Gudang",
  laporan: "Laporan",
  notifikasi: "Notifikasi",
  pengaturan: "Pengaturan",
  pengguna: "Pengguna",
  sales: "Sales & Komisi",
  wallet: "Wallet",
  master: "Data Master",
  peta: "Peta Jaringan",
  sistem: "Sistem",
  konfirmasi: "Konfirmasi Bayar",
};

// Segmen pertama path /dashboard/<segmen> -> menu_key
export const SEGMENT_MENU: Record<string, string> = {
  "": "dashboard",
  pelanggan: "pelanggan",
  tagihan: "tagihan",
  paket: "paket",
  router: "router",
  hotspot: "hotspot",
  ftth: "ftth",
  keuangan: "keuangan",
  tiket: "tiket",
  gudang: "gudang",
  laporan: "laporan",
  notifikasi: "notifikasi",
  pengaturan: "pengaturan",
  pengguna: "pengguna",
  sales: "sales",
  wallet: "wallet",
  master: "master",
  peta: "peta",
  sistem: "sistem",
  konfirmasi: "konfirmasi",
};

export const STAFF_ROLES = ["superadmin", "admin", "teknisi", "cs", "sales"] as const;

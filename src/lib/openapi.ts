/**
 * openapi.ts — STREAM S5: Dokumentasi OpenAPI (setara Documentation.php PTA).
 *
 * Membangun spesifikasi OpenAPI 3.0 dari daftar route yang BENAR-BENAR ADA
 * (manifest hasil `node scripts/generate-openapi-routes.js`, tersimpan di
 * src/lib/openapi-routes.json). Tidak ada endpoint yang dikarang: setiap
 * path & method di spec berasal dari named export GET/POST/PUT/PATCH/DELETE
 * di bawah src/app/api (satu route.ts per endpoint).
 *
 * Deskripsi per grup ditulis manual (GROUP_META) — bukan asal generate.
 */
import manifest from "./openapi-routes.json";

/* ------------------------------------------------------------------ */
/* Tipe minimal OpenAPI 3.0 (tanpa dependensi)                         */
/* ------------------------------------------------------------------ */

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    securitySchemes: Record<string, Record<string, string>>;
    responses: Record<string, { description: string }>;
  };
}

interface OpenApiOperation {
  tags: string[];
  summary: string;
  description: string;
  operationId: string;
  parameters?: { name: string; in: string; required: boolean; schema: { type: string }; description: string }[];
  security?: Record<string, string[]>[];
  responses: Record<string, { description: string }>;
}

interface RouteEntry {
  path: string;
  group: string;
  methods: string[];
  pathParams: string[];
}

/* ------------------------------------------------------------------ */
/* Metadata grup — ditulis manual berdasarkan fungsi tiap prefix route */
/* ------------------------------------------------------------------ */

const GROUP_META: Record<string, { title: string; description: string }> = {
  "activity-logs": {
    title: "Log Aktivitas",
    description: "Riwayat aktivitas staff di dalam sistem (audit trail).",
  },
  auth: {
    title: "Autentikasi",
    description: "Login staff/member/partner, logout, dan info sesi berjalan (cookie genisp_session).",
  },
  commissions: {
    title: "Komisi",
    description: "Komisi penjualan: daftar komisi sales dan pembayaran komisi.",
  },
  "confirm-payments": {
    title: "Konfirmasi Pembayaran",
    description: "Konfirmasi pembayaran manual dari pelanggan beserta review/penyetujuan staff.",
  },
  coupons: {
    title: "Kupon Diskon",
    description: "Kelola kupon diskon dan validasi kode kupon saat checkout.",
  },
  coverages: {
    title: "Cakupan Area",
    description: "Titik cakupan layanan untuk peta ketersediaan jaringan.",
  },
  debts: {
    title: "Piutang",
    description: "Catatan piutang/hutang pelanggan: daftar, tambah, dan kelola pelunasan.",
  },
  docs: {
    title: "Dokumentasi API",
    description: "Menyajikan spesifikasi OpenAPI 3.0 (JSON) hasil generate dari route yang ada.",
  },
  cron: {
    title: "Tugas Terjadwal",
    description:
      "Endpoint internal untuk cron: generate tagihan, pengingat pembayaran, dan auto-isolir. Diamankan dengan header Authorization: Bearer CRON_SECRET.",
  },
  customers: {
    title: "Pelanggan",
    description: "Kelola data pelanggan: CRUD, ubah status, isolir/buka isolir, dan sinkronisasi ke router.",
  },
  finance: {
    title: "Keuangan",
    description: "Pemasukan, pengeluaran, pendapatan pending (butuh persetujuan), dan ringkasan keuangan.",
  },
  ftth: {
    title: "Jaringan FTTH",
    description: "Data infrastruktur fiber: OLT, ODC, dan ODP.",
  },
  help: {
    title: "Tiket Bantuan",
    description: "Helpdesk: tiket keluhan pelanggan, balasan tiket, dan tipe tiket.",
  },
  hotspot: {
    title: "Hotspot",
    description: "Paket hotspot dan voucher hotspot.",
  },
  install: {
    title: "Installer",
    description: "Wizard instalasi awal: cek status, prasyarat, migrasi database, dan pembuatan akun admin.",
  },
  invoices: {
    title: "Tagihan",
    description: "Kelola tagihan: daftar, detail, generate massal, dan pembayaran tagihan.",
  },
  map: {
    title: "Peta Jaringan",
    description: "Data peta: titik perangkat dan jalur kabel jaringan.",
  },
  masters: {
    title: "Data Master",
    description: "Master perangkat: GSM, modem, ONU, dan VoIP.",
  },
  notifications: {
    title: "Notifikasi",
    description: "Daftar notifikasi dan pengiriman notifikasi ke pelanggan.",
  },
  notify: {
    title: "Template & Log Notifikasi",
    description: "Template pesan notifikasi, riwayat pengiriman, dan uji kirim.",
  },
  packages: {
    title: "Paket Internet",
    description: "Kelola paket layanan internet (nama, harga, kecepatan).",
  },
  partner: {
    title: "Portal Partner",
    description: "Area partner/reseller: profil, daftar pelanggan, dan dompet komisi.",
  },
  partners: {
    title: "Manajemen Partner",
    description: "Kelola akun partner/reseller beserta dompet komisinya (sisi admin).",
  },
  payments: {
    title: "Pembayaran Online",
    description: "Checkout pembayaran dan webhook payment gateway (Xendit, Midtrans, Tripay, DOKU, iPaymu, Duitku, BNI, Moota, Indosat, Tukeur).",
  },
  portal: {
    title: "Portal Pelanggan",
    description: "Area member: profil, tagihan milik sendiri, dan reset koneksi mandiri.",
  },
  products: {
    title: "Produk",
    description: "Katalog produk/barang (perangkat) yang dijual.",
  },
  promos: {
    title: "Promo",
    description: "Kelola promo dan penawaran khusus.",
  },
  public: {
    title: "API Publik",
    description: "Endpoint tanpa login: cek tagihan, registrasi, konfirmasi pembayaran, beli voucher, lacak tiket.",
  },
  "receipt-templates": {
    title: "Template Struk",
    description: "Template struk/nota cetak (mis. thermal) untuk tagihan dan pembayaran.",
  },
  reports: {
    title: "Laporan",
    description: "Ringkasan laporan operasional dan keuangan.",
  },
  roles: {
    title: "Peran & Izin",
    description: "Role staff, daftar permission, dan pengecekan hak akses.",
  },
  routers: {
    title: "Router MikroTik",
    description: "Kelola router: CRUD, uji koneksi API, pantau sesi live, dan kick sesi.",
  },
  sales: {
    title: "Fee Sales",
    description: "Fee/komisi untuk tim sales.",
  },
  services: {
    title: "Layanan",
    description: "Daftar layanan yang ditawarkan (untuk landing page & paket).",
  },
  settings: {
    title: "Pengaturan",
    description: "Konfigurasi aplikasi (nama perusahaan, template pesan, parameter billing, dsb).",
  },
  slides: {
    title: "Slide Banner",
    description: "Banner/slide untuk halaman depan (landing page).",
  },
  system: {
    title: "Sistem",
    description: "Operasional sistem: backup & restore database, dan import data pelanggan.",
  },
  users: {
    title: "Pengguna Staff",
    description: "Kelola akun staff/admin beserta status aktifnya.",
  },
  wallet: {
    title: "Dompet Saya",
    description: "Dompet milik sendiri: saldo, topup, dan penyelesaian (settle) topup.",
  },
  wallets: {
    title: "Dompet (Admin)",
    description: "Kelola dompet pelanggan/partner dari sisi admin, termasuk penyesuaian saldo.",
  },
  warehouse: {
    title: "Gudang",
    description: "Inventaris: barang, tipe barang, pembelian, stok masuk/keluar, supplier, dan vendor.",
  },
};

/** Prefix path yang memang publik (tanpa sesi). Selain ini → butuh cookie sesi. */
const PUBLIC_PREFIXES = ["/api/public/", "/api/payments/webhook/", "/api/auth/login"];
const CRON_PREFIX = "/api/cron/";

const METHOD_VERB: Record<string, string> = {
  GET: "Ambil",
  POST: "Kirim",
  PUT: "Ganti",
  PATCH: "Ubah",
  DELETE: "Hapus",
  HEAD: "Header",
  OPTIONS: "Opsi",
};

function humanizePath(openapiPath: string): string {
  return openapiPath
    .replace(/^\/api\//, "")
    .split("/")
    .map((seg) => {
      const m = seg.match(/^\{(.+)\}$/);
      if (m) return `(${m[1]})`;
      return seg.replace(/-/g, " ");
    })
    .join(" › ");
}

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p.slice(0, -1) || path.startsWith(p));
}

function isCron(path: string): boolean {
  return path.startsWith(CRON_PREFIX);
}

/** Bangun dokumen OpenAPI 3.0 dari manifest route. Murni & deterministik. */
export function buildOpenApiSpec(): OpenApiDocument {
  const routes = (manifest as { routes: RouteEntry[] }).routes;

  const seenGroups = new Set<string>();
  const tags: OpenApiDocument["tags"] = [];
  const paths: OpenApiDocument["paths"] = {};

  for (const route of routes) {
    const meta = GROUP_META[route.group] ?? {
      title: route.group,
      description: `Endpoint grup ${route.group}.`,
    };
    if (!seenGroups.has(route.group)) {
      seenGroups.add(route.group);
      tags.push({ name: meta.title, description: meta.description });
    }

    const pathItem: Record<string, OpenApiOperation> = {};
    for (const method of route.methods) {
      const verb = METHOD_VERB[method] ?? method;
      const operationId =
        method.toLowerCase() +
        route.path
          .split("/")
          .filter(Boolean)
          .slice(1)
          .map((s) => s.replace(/^\{(.+)\}$/, "by-$1").replace(/[^a-zA-Z0-9]+/g, "-"))
          .join("-");

      const op: OpenApiOperation = {
        tags: [meta.title],
        summary: `${verb} ${humanizePath(route.path)}`,
        description: `${meta.description} (${method} ${route.path})`,
        operationId,
        responses: {
          "200": { description: "Berhasil" },
          "400": { description: "Permintaan tidak valid" },
          ...(isPublic(route.path) || isCron(route.path)
            ? {}
            : { "401": { description: "Belum login / sesi tidak valid" } }),
        },
      };

      if (route.pathParams.length > 0) {
        op.parameters = route.pathParams.map((name) => ({
          name,
          in: "path",
          required: true,
          schema: { type: "string" },
          description: `Parameter path ${name}`,
        }));
      }

      if (isCron(route.path)) {
        op.security = [{ cronAuth: [] }];
        op.description += " Membutuhkan header Authorization: Bearer <CRON_SECRET>.";
      } else if (!isPublic(route.path)) {
        op.security = [{ sessionAuth: [] }];
      }

      pathItem[method.toLowerCase()] = op;
    }
    paths[route.path] = pathItem;
  }

  tags.sort((a, b) => a.name.localeCompare(b.name, "id"));

  return {
    openapi: "3.0.3",
    info: {
      title: "GenISP API",
      version: "1.0.0",
      description:
        "Dokumentasi REST API GenISP (rebuild PTA) — digenerate otomatis dari route yang benar-benar ada di src/app/api. " +
        "Sebagian besar endpoint membutuhkan cookie sesi (genisp_session) dari login; endpoint /api/public/* dan webhook payment gateway bersifat publik; /api/cron/* memakai Bearer CRON_SECRET.",
    },
    servers: [{ url: "/", description: "Server aplikasi ini" }],
    tags,
    paths,
    components: {
      securitySchemes: {
        sessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "genisp_session",
          description: "Cookie sesi httpOnly yang didapat setelah login via POST /api/auth/login.",
        },
        cronAuth: {
          type: "http",
          scheme: "bearer",
          description: "Header Authorization: Bearer <CRON_SECRET> untuk endpoint /api/cron/*.",
        },
      },
      responses: {
        Unauthorized: { description: "Belum login / sesi tidak valid" },
      },
    },
  };
}

/** Jumlah route di manifest (untuk verifikasi). */
export function routeManifestCount(): number {
  return (manifest as { routes: RouteEntry[] }).routes.length;
}

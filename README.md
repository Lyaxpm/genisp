# GenISP v2.0

Platform billing & network automation untuk ISP — rebuild total dari aplikasi PTA (CodeIgniter/PHP)
ke **Next.js 14 full-stack** (frontend + backend API dalam satu repo). Tanpa license, 100% milik sendiri.

## Fitur

**Publik (landing page)**
- Hero, widget Cek Tagihan (ID / no HP), daftar paket, layanan, promo, cakupan wilayah, tentang kami
- Registrasi pelanggan online, konfirmasi pembayaran manual, halaman bayar per invoice
- **Peta cakupan interaktif** (cek lokasi saya), **speedtest**, **beli voucher hotspot**, **bantuan/tiket** (buat + lacak)
- Login 3 peran: Staff, Member (pelanggan), Partner (reseller). PWA-ready.

**Dashboard Admin (21 menu)**
- Dashboard statistik + grafik, Pelanggan (CRUD, status, router-sync, isolir/buka via MikroTik, import CSV)
- Tagihan (generate massal, tandai lunas, cetak A4 + struk thermal 80mm, kupon, PPN)
- Paket internet, Router MikroTik (test koneksi, **live: interfaces + resource, kick session**)
- Hotspot (paket & generate voucher → **otomatis push ke router** + debit wallet reseller)
- FTTH: OLT → ODC → ODP (+ data ONU), **Peta jaringan** (ODC/ODP/pelanggan/kabel fiber)
- Keuangan (pemasukan/pengeluaran, **approval pemasukan pending**, ringkasan)
- **Tiket bantuan** (assign, balas, prioritas), **Gudang** (barang, stok in/out, pembelian, supplier, vendor)
- **Sales & komisi** (aturan fee, komisi otomatis per invoice lunas, bayar komisi)
- **Wallet** (semua dompet + adjust manual + riwayat)
- **Data Master** (modem, GSM, VoIP, ONU), Konfirmasi bayar, Laporan + export CSV
- **Notifikasi** (template WA/SMS/Email/Telegram, riwayat, test kirim)
- **Hak Akses** (RBAC granular per menu), **Sistem** (backup/restore JSON)
- Pengaturan (profil perusahaan, semua key gateway, PPN, SMTP, SMS, Telegram), Pengguna

**Portal Member** — status layanan, tagihan, bayar (gateway/wallet), **wallet + topup**, tiket bantuan, **reset koneksi mandiri**, profil
**Portal Partner** — saldo wallet, daftar pelanggan, riwayat transaksi

**Backend API** (±130 endpoint): auth JWT (httpOnly cookie), RBAC granular, CRUD semua modul.
Checkout & webhook **10 gateway**: Xendit, Midtrans, Tripay, **Duitku, Doku, iPaymu, BNI VA, Moota (mutasi bank), Indosat, Tukeur** — semua verifikasi signature.
**Otomasi MikroTik penuh**: sync PPP secret/hotspot user, isolir/buka (disable + tendang sesi), cron auto-isolir eksekusi di router.
**Cron otomatis**: generate-invoices, reminders (WA/SMS/Email), auto-isolir.

## Tech stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS, Postgres (Supabase), JWT via `jose`,
`postgres` (porsager) untuk query, `recharts` untuk grafik. Deploy di **Vercel** (cron via `vercel.json`).

## Cara jalan lokal

```bash
npm install
cp .env.example .env        # isi DATABASE_URL, JWT_SECRET, CRON_SECRET
npm run db:migrate          # jalankan 001_schema.sql + 002_seed.sql
npm run dev                 # http://localhost:3000
```

Login awal: `admin@genisp.id` / `admin123` — **ganti setelah login pertama.**

## Deploy ke Vercel

Lihat **DEPLOY.md** (panduan langkah-demi-langkah Bahasa Indonesia).

## Struktur

```
src/app/            → halaman (publik, dashboard, portal, partner) + API routes
src/app/api/        → ±70 endpoint REST
src/components/     → admin.tsx (UI dashboard), public.tsx (UI publik/portal)
src/lib/            → db, auth, utils, billing, finance, gateways, notify, routeros
supabase/migrations/→ 001_schema.sql (skema), 002_seed.sql (data awal)
vercel.json         → jadwal cron
```

## Pembaruan: keamanan transaksi & GenieACS

- Pemeriksaan izin langsung pada API tiap modul, default izin per role, dan validasi ulang akun aktif.
- Pelunasan invoice, debit wallet, verifikasi top-up, dan pembelian voucher menggunakan transaksi/operasi atomik.
- Callback pembayaran menggunakan settlement terpusat dengan penguncian invoice dan payment.
- Migrasi terurut dengan checksum dan riwayat eksekusi; Next.js diperbarui ke patch 14.2.35.
- **GenieACS**: dashboard perangkat, pencarian/pagination, kaitan pelanggan, refresh, reboot, Wi-Fi TR-098/TR-181, antrean tugas, dan audit pengiriman.

Lihat [GENIEACS.md](GENIEACS.md) untuk setup NBI dan [DEPLOY.md](DEPLOY.md) untuk upgrade. Jalankan `npm test`, `npm run typecheck`, dan `npm run build` sebelum deploy.

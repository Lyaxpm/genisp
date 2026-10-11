# Deploy GenISP ke Vercel — Panduan Lengkap

## 1. Siapkan database (Supabase, gratis)

1. Buat akun di https://supabase.com → **New project** (pilih region Singapore).
2. Tunggu project jadi → buka **Project Settings → Database** → salin **Connection string**
   (mode **Session**, port 5432). Contoh:
   `postgresql://postgres:xxxx@db.yyy.supabase.co:5432/postgres`
3. Buka **SQL Editor** → **New query** → paste isi `supabase/migrations/001_schema.sql` → **Run**.
4. Query baru lagi → paste isi `supabase/migrations/002_seed.sql` → **Run**.
5. Login awal: `admin@genisp.id` / `admin123` (ganti setelah login pertama).

## 2. Push ke GitHub

```bash
cd genisp
git init && git add . && git commit -m "GenISP v1.0"
gh repo create genisp --public --source=. --push
# atau buat repo manual di github.com lalu:
# git remote add origin https://github.com/USERNAME/genisp.git && git push -u origin main
```

## 3. Deploy di Vercel

1. https://vercel.com → **Add New → Project** → import repo `genisp`.
2. Framework otomatis terdeteksi (Next.js). Klik **Environment Variables**, isi:
   | Key | Isi |
   |---|---|
   | `DATABASE_URL` | connection string Supabase dari langkah 1 |
   | `JWT_SECRET` | string acak ≥ 32 karakter |
   | `CRON_SECRET` | string acak (untuk cron) |
   | `XENDIT_SECRET_KEY` | (opsional) secret key Xendit |
   | `MIDTRANS_SERVER_KEY` | (opsional) |
   | `MIDTRANS_CLIENT_KEY` | (opsional) |
   | `TRIPAY_API_KEY` / `TRIPAY_PRIVATE_KEY` / `TRIPAY_MERCHANT_CODE` | (opsional) |
   | `WHATSAPP_API_URL` / `WHATSAPP_API_KEY` | (opsional) gateway WA |
   | `TELEGRAM_BOT_TOKEN` | (opsional) |
3. **Deploy**. Tunggu hingga "Ready".
4. Cron otomatis aktif dari `vercel.json` (generate tagihan, reminder, auto-isolir).
   Pastikan `CRON_SECRET` terisi agar endpoint `/api/cron/*` jalan.

## 4. Setelah live

1. Buka `https://genisp-xxx.vercel.app/login` → login admin → **ganti password** di menu Pengguna.
2. Menu **Pengaturan**: isi profil perusahaan, warna brand, dan key payment gateway.
3. Tambah paket internet, router, lalu pelanggan. Generate tagihan pertama di menu **Tagihan**.

## Catatan

- Webhook gateway: daftarkan URL `https://domain-anda.vercel.app/api/payments/webhook/xendit`
  (atau `/midtrans`, `/tripay`) di dashboard masing-masing gateway.
- Tanpa key gateway, checkout otomatis memberi instruksi pembayaran **manual**.
- WhatsApp: tanpa `WHATSAPP_API_URL`, notifikasi hanya tercatat di menu Notifikasi (log).

## Pembaruan transaksi, izin API, dan GenieACS

1. Backup database sebelum upgrade, kemudian `git pull` dan `npm ci`.
2. Jalankan `npm run db:migrate` dari lingkungan yang memiliki `DATABASE_URL`. Runner sekarang menggunakan transaksi, advisory lock, dan tabel `schema_migrations`; file yang sudah diterapkan tidak dijalankan ulang. Database lama tanpa tabel riwayat akan menjalankan SQL kompatibel `IF NOT EXISTS` sekali; seed paket tidak menambahkan contoh bila tabel sudah berisi data.
3. Isi environment GenieACS sesuai [GENIEACS.md](GENIEACS.md), lalu redeploy aplikasi. Kredensial NBI tidak masuk GitHub.
4. Verifikasi **Hak Akses**. Izin eksplisit lama tetap berlaku. Bila belum ada aturan, admin mendapat modul operasional, CS mendapat pelanggan/tagihan/konfirmasi/tiket, teknisi mendapat pelanggan/router/FTTH/peta/tiket/GenieACS, sales mendapat dashboard/pelanggan. Sistem tetap khusus superadmin. Akun nonaktif dan perubahan role kini dicek ulang pada server.
5. `npm test`, `npm run typecheck`, dan `npm run build` tersedia untuk validasi.

Pembayaran kedua untuk invoice yang sudah lunas diberi status `review` (tidak menambah pemasukan kedua). Periksa untuk rekonsiliasi/refund jika dana eksternal benar-benar masuk. Perubahan ini mencegah duplikasi baru; tidak mengubah catatan ganda lama secara otomatis. Notifikasi pembayaran dikirim setelah transaksi commit dan masih bersifat best-effort.

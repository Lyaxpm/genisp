# Integrasi GenieACS

Menu **Dashboard → GenieACS** menggunakan Northbound API (NBI) server GenieACS yang sudah tersedia. GenISP tidak menginstal server ACS dan tidak mengganti konfigurasi TR-069 perangkat secara otomatis.

## Konfigurasi

1. Jalankan `npm ci` dan `npm run db:migrate` dengan `DATABASE_URL` yang benar. Migrasi `005_genieacs.sql` menyimpan kaitan perangkat–pelanggan dan audit aksi; tidak menyimpan password ACS atau Wi-Fi.
2. Isi environment server GenISP:

```dotenv
GENIEACS_NBI_URL=https://acs-api.example.com
# Bila reverse proxy NBI menggunakan Basic Auth:
GENIEACS_NBI_USERNAME=genisp
GENIEACS_NBI_PASSWORD=isi-password-di-server
# Alternatif untuk reverse proxy yang menggunakan Bearer token:
GENIEACS_NBI_TOKEN=
```

Gunakan alamat **NBI**, umumnya port **7557**, bukan UI GenieACS (3000) atau CWMP (7547). Basic/Bearer di atas adalah autentikasi reverse proxy NBI, bukan otomatis akun login UI GenieACS. Jika TOKEN diisi, token mengungguli Basic Auth.

Jangan memakai prefiks `NEXT_PUBLIC_` untuk kredensial. Gunakan HTTPS dengan autentikasi untuk NBI melalui internet, atau akses HTTP hanya melalui jaringan privat yang dipercaya. GenISP tidak meneruskan respons mentah perangkat, password Wi-Fi, atau header autentikasi ke browser.

Jika GenISP berjalan di Vercel, alamat privat/LAN ACS harus memiliki jalur jaringan yang dapat dijangkau deployment; `127.0.0.1` di Vercel bukan VPS ACS. Setelah environment berubah, redeploy/restart aplikasi.

3. Login sebagai superadmin/admin/teknisi dan buka **GenieACS → Tes koneksi ACS**. Izin khusus dapat diubah melalui **Hak Akses → GenieACS**.

## Fitur

- Cari ID perangkat, serial number, dan pabrikan; hasil memakai pagination.
- Model, firmware, tag, dan waktu inform terakhir; label “inform baru” berarti kontak dalam 15 menit, bukan pemeriksaan online langsung.
- Kaitkan perangkat ke pelanggan yang ada. Satu pelanggan dapat memiliki beberapa perangkat.
- Refresh parameter, reboot dengan konfirmasi, dan edit nama/password Wi-Fi.
- Wi-Fi menggunakan parameter yang benar-benar dilaporkan perangkat: TR-098 `WLANConfiguration` atau TR-181 `SSID`/`AccessPoint` dengan pemetaan `SSIDReference`. Parameter harus writable. Dukungan parameter vendor tertentu dapat memerlukan penyesuaian.
- Password kosong mempertahankan password lama. SSID maksimal 32 byte; password baru 8–63 karakter ASCII.
- HTTP 202 berarti tugas masuk antrean, belum berhasil dieksekusi. Tugas menunggu inform berikutnya bila connection request tidak dapat menjangkau CPE.
- Lihat antrean aktif dan riwayat pengiriman GenISP. Riwayat menyimpan status pada saat pengiriman; status `unknown`/`sending` perlu dibandingkan dengan antrean dan data perangkat sebelum mengulang. Tidak ada retry otomatis untuk reboot/perubahan Wi-Fi.

## API internal GenISP

Semua endpoint membutuhkan sesi staff aktif dan izin menu `genieacs`.

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/genieacs/status` | Tes NBI |
| `GET /api/genieacs/devices?q=&page=1&limit=20` | Daftar perangkat |
| `GET /api/genieacs/detail?device_id=...` | Detail aman, antrean, audit |
| `GET /api/genieacs/customers?q=...` | Cari pelanggan untuk pengaitan |
| `PUT /api/genieacs/link` | `{device_id, customer_id}`; `null` melepas kaitan |
| `POST /api/genieacs/tasks` | `{device_id, action}`; `refresh`, `reboot`, atau `wifi` |

Aksi Wi-Fi menambahkan `path`, `ssid`, dan opsional `password`. Server mencocokkan path dengan parameter perangkat; arbitrary task dan factory reset tidak dibuka.

Referensi protokol: https://docs.genieacs.com/en/latest/api-reference.html

## Validasi

`npm test` menguji transaksi di PostgreSQL embedded (PGlite), rollback saat kegagalan ledger/income, idempotensi pelunasan/topup, dan kontrak NBI menggunakan server HTTP lokal. PGlite menserialkan transaksi; tes ini bukan pengganti pengujian konkurensi multi-koneksi pada PostgreSQL produksi. `npm run typecheck` dan `npm run build` memvalidasi TypeScript dan build produksi.

Uji dengan satu CPE nonproduksi terlebih dahulu untuk memastikan jalur connection request dan parameter Wi-Fi firmware Anda. Koneksi ACS/CPE nyata belum dapat diverifikasi tanpa konfigurasi server Anda.

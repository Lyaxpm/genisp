# Katalog Fitur — PTA (PT. Arsuar Digital Bisnis)

> Aplikasi billing ISP berbasis **CodeIgniter 3** (PHP). Dianalisis statis dari `pta.zip`
> (105 controller, ±48 model). Tidak ada file `.sql` — skema disimpulkan dari
> pemakaian insert/select di model. Status invoice: `BELUM BAYAR` / `SUDAH BAYAR`.

---

## 1. Daftar Modul (Controller)

### 1.1 Auth & Akses
| Controller | Tujuan | Method publik utama |
|---|---|---|
| **Auth** | Login/logout/registrasi user tabel `user` | `index` (login → session → dashboard/member), `register`, `verify` (aktivasi email), `forgotpassword`/`resetPassword`, `verifyotp`, `changePassword`, `logout` |
| **User** | Manajemen akun internal | `index`, `admin/customer/mitra/operator/teknisi` (tab per role), `register`, `edit_user`/`editUser` (kirim WA bila reset password), `del`/`delselected`, `resetpasswordselected`, `profile`/`edit`/`changepassword` |
| **Role** | Role & permission granular (role_id=1 saja bisa akses) | `index`/`access`/`tableaccess` (matriks hak akses), `update`, `rolegroup`/`addgroup`/`editrolegroup`/`delrolegroup`, `updatemenuoperator/mitra/teknisi/outlet/kolektor/finance` (sidebar per role). Role default: 1=Administrator, 2=Pelanggan, 3=Operator, 4=Mitra, 5=Teknisi, 7=Kolektor, 8=Finance. Cek via helper `haspermission('key')` → tabel `role_management` |
| **Licence** | Lisensi aplikasi | `update`/`sync`/`renew`/`notregistered` |

### 1.2 Billing Inti
| Controller | Tujuan | Method publik utama |
|---|---|---|
| **Customer** | CRUD pelanggan + aksi Mikrotik massal | `add`/`store` (registrasi, auto-insert `services`, opsional `createbill`), `update`/`edit`, `delete`/`delselected`, `setstatus`/`setactive`/`setnonactive`/`active`/`nonactive`/`wait`/`free`/`isolir`, `import`/`importtodatabase`, `releasemikrotik`/`setidmikrotik`/`setusermikrotik`/`setmaxisolir`/`setnextmonth`/`setperiodmonth`/`setstaticip`/`setdhcpip`/`setdynamicdue`, `openisolir`/`setautoisolir`/`setisolir`/`unsetisolir`/`setcodeunique`/`setpra`/`setpasca`/`updateduedate`/`bulkupdatedueisolir`/`cektbill`/`sinkron`, `va`/`editva`/`fixva`, `createuserlogin`, `maps`/`getmaps`, DataTables `getAllCustomer/getActiveCustomer/...` |
| **Bill** | Manajemen invoice | `addBill` (manual 1..N bulan, prorata/full, cegah duplikat `cekPeriode`), `addBillDraf`/`filterdraf`/`generateselected` (draf→final), `generateBill`/`generateBillPreview` (massal), `payment`/`payselected` (tandai lunas), `confirmPayment`/`confirm`/`confirmdetail`/`confirmUpdate`/`deleteconfirm` (konfirmasi manual), `setisolir`/`openisolir`/`updatedateisolir`/`updateduedate`, `additem`/`updateitem`/`deliteminv`, `editstatus`, `setppn`/`updateppn`, `debt`/`getdebt`, `export`/`uploadimport`, `printinvoice*` (A4/thermal/custom/template) |
| **Checkout** | Halaman bayar publik | `payment` (per invoice; lengkapi `invoice_detail` dari `services` + `fixamount` bila kosong; migrasi `x_external_id` lama), `moota` (varian mutasi bank), `applycoupon` (AJAX validasi kupon → set `code_coupon`/`disc_coupon`) |
| **Renew** | Webhook internal lisensi | `index` (terima `{token, new_date}` → update `company.expired`) |

> `Confirm_payment.php` **tidak ada** — konfirmasi pembayaran ada di `Bill.php`.

### 1.3 Payment Gateway
| Controller | Gateway | Checkout | Callback (nama persis) | Library |
|---|---|---|---|---|
| **Snap** + `Notification` | Midtrans Snap | `Snap::token()`/`Snap::finish()` | `Notification::index()` — SHA512(order_id+status_code+gross_amount+serverKey), terima settlement/capture | `libraries/Midtrans.php`, `libraries/Veritrans.php` |
| **Xendit** | Xendit | `Payment::createinvoice()` (Invoice), `Payment::createpayment()` (VA/eWallet/Retail) | `Xendit::payinvoice()` (tanpa verifikasi signature di kode) | Composer SDK `Xendit\Xendit` |
| **Duitku** | Duitku | `Duitku::checkout()` | `Duitku::index()` — MD5, resultCode `00` | cURL murni |
| **Tripay** | Tripay | `Tripay::checkout()` | `Tripay::index()` — HMAC-SHA256 vs header `X-Callback-Signature` | cURL murni |
| **Doku** | Doku O2O (Alfa/Indomaret) | `Doku::updateva()` | `Doku::inquiry/inquiry_alfa/inquiry_indomaret/payment_alfa/payment_indomaret` — HMAC-SHA256 | cURL murni |
| **Ipaymu** | iPaymu | `Ipaymu::checkout()` | `Ipaymu::notify()` — token HMAC query + cek amount | cURL murni |
| **Indosat** | Indosat | `Indosat::create_payment()`/`checkout()` | `Indosat::callback()` — HMAC base64 vs `X-WC-WEBHOOK-Signature` | cURL murni |
| **Tukeur** | Tukeur | `Tukeur::createinvoice()` | `Tukeur::callback()` — HMAC vs `X-Signature` | cURL murni |
| **Va** | BNI e-Collection VA direct | `Va::createbilling()` / helper `createbillingva()` (payload enkripsi `BniEnc`) | `Va::bni()` (decrypt + cocokkan client_id); rekonsiliasi `autoCheckVAfromTable`/`autoCheckUnpaidVA` | `libraries/BniEnc.php`; `libraries/Bri.php` (BRIVA, wrapper siap) |
| **Moota**/**Mutation** | Mutasi bank otomatis | — | `Moota::webhook()` (HMAC vs header `Signature`), `Mutation::webhookmutasibank()` (auth `moota.token`), `Mutation::mesinotomatis()` (whitelist IP, type `K`=kredit) | `libraries/Mootaa.php` |
| **Flip** | — | TIDAK dipakai checkout — hanya test sandbox BigFlip Disbursement | — | — |

- **Wallet**: `Wallet.php` — `index`/`detail`/`detailaccount`/`adjust` (admin isi/potong manual), `setting`/`savesetting` (program point `wallet_point_*` di tabel `other`). Topup: `Member::wallettopup()` → referensi `TOPUP{customerId}-{ymdHis}{rand3}` → gateway → callback → `wallet_topup_complete()` (idempotent). Bayar invoice pakai saldo: `api/Mobiledata::my_invoice_pay_wallet()` — debit `SELECT ... FOR UPDATE`, metode `WALLET`. Reseller wallet (account_type='user'): **debit otomatis saat reseller beli voucher hotspot**, refund bila gagal.
- Konfig gateway: tabel `payment_gateway` (`vendor, api_key, server_key, client_key, kodemerchant, is_active, mode, expired, admin_fee, domain_api JSON`); BNI VA di tabel `va`; Doku di tabel `doku`; Moota di tabel `moota`.

### 1.4 Network / Infrastruktur
| Controller | Tujuan | Method publik utama |
|---|---|---|
| **Router** | Master data router (tabel `router`) | `add` (alias, ip_address, username, password, port, ros_version V6/V7, services API/REST, user_manager, hotspot_manager), `edit`/`delete`, `cekconnection`, `reboot`, `isolir`/`openisolir`/`kick` (helper), `syncstatus`, `moverouter`/`movecustomer`, `ping`, `resource`, `userman` |
| **Mikrotik** | Panel live per-router (session router aktif) | `dashboard`, `interface`/`traffic`, `pppoe`/`pppoeactive`/`addPppoeUser`/`delPppoeUser`/`disablepppoeuser`/`enablepppoeuser`, `profileppp`/`addprofileppp`, `hotspotuser`/`addHotspotUser`/`delHotspotUser`/`disablehotspotuser`/`enablehotspotuser`, `hotspotactive`/`hotspotprofile`/`hotspotbinding`/`hotspothost`, `isolir`/`openisolir` (bulk), `syncfromdb`, `backup`, `customer`/`client` |
| **Hotspot** | Manager voucher hotspot per-router | `manager`, `hotspot_generate_users` (format `prefix+random`, mode rand/same, limit uptime/bytes), `hotspot_user_save/delete/active_kick`, `hotspot_packages_data/sync_packages/package_save/delete/toggle`, `voucher_templates/.../activate`, `reseller_topup_request/list/process`, `settings`/`clean_expired_users` |
| **Olt** | Manajemen OLT multi-vendor (HSGQ, CDATA, VSOL, Hioso, ZTE) | `add`/`edit`/`delete`/`pingOlt`, `dashboard`, `onutable`/`onudetail`/`onulist`, `renameonu`/`rebootonu`/`deregisteronu`, `getPonStatus`/`getcpu`/`topo`, `syncCustomer`, `smartolt` |
| **Odc** | Master ODC (tabel `m_odc`) | `add`/`edit`/`delete`/`getodc`, `codeodc_check`, `doc/adddoc/editdoc/deletedoc` |
| **Odp** | Master ODP (tabel `m_odp`) | `add`/`edit`/`delete`/`getodp`/`getportodp`, `codeodp_check`, `releasefromodc`, `updateportodc` (pindah port, validasi kapasitas), `updateportcustomer` (petakan pelanggan→ODP/port) |
| **Mapping** | API JSON peta | `get_odc`/`get_odp`/`get_customers`/`get_customers_with_status` (source=genieacs\|mikrotik\|olt), `get_cables`/`save`/`delete`/`save_cable_colors` (panjang auto-haversine), `get_odp_ports` |
| **Coverage** | Wilayah cakupan | `add`/`edit`/`deletecoverage`, `getKab/getKec/getKel`, `package/addpackagecoverage/delpackagecoverage`, `detail`, `coverageCustomers/coverageInfra`. Cek coverage **client-side** (Leaflet `distanceTo`, tanpa hitung radius di backend) |
| **Maps** | Konfigurasi API peta (tabel `maps`: token, vendor) | `set`, halaman `customer/coverage/odp/odc` + JSON `getmaps/...` |
| **Modem** | Inventaris modem pelanggan | `customer`, `add`/`edit`/`update`/`delete` |
| **Gsm** | Master user GSM | `add`/`edit`/`preview`/`delete`, `getquotabyoperator`, `getgsmuser` |
| **Voip** | Master nomor VoIP | `add`/`edit`/`delete`/`getvoip` |
| **Acs** | Integrasi GenieACS TR-069 (tabel `genieacs`) | `devices`/`detaildevices`, `add`/`edit`/`delete` server, `ping`, `action` (reboot/factory reset), `syncCustomer`, `import_view`/`import_upload` |
| **Zte**/**Vsol** | Monitoring OLT via SNMP / HTTP scraping | `dashboard`/`onu`, `reboot`/`rename`/`onuoptical` |

Library: `Mikweb.php` (RouterOS API biner, V6), `ROS7Rest.php` (REST API v7), `Ssh2.php` (SSH), `ACSRequest.php` (GenieACS NBI).

### 1.5 Bisnis & Keuangan
| Controller | Tujuan | Method publik utama |
|---|---|---|
| **Package** | Paket internet (`package_item` + `package_category`) | `index`, `addPItem`/`editPItem`/`deletePItem`, `addPcategory`/`editPcategory`/`deletePCategory`, `Item`/`Itemnonactive`/`Itemactive`, `stats`/`stats_customers_by_package`, `saveCoveragePackage`, `getpackagemitra`, `updatepackagecustomer`/`switchpackagecustomer` |
| **Product** | Etalase toko (opsional taut `package_item_id`, harga fallback ke paket) | `data`, `add`/`edit`/`del` |
| **Services** | Layanan/add-on per `no_services` pelanggan | `index`/`detail`, `add`/`edit`/`delete`, `changeprofile`, `cekdouble`/`delldoubleservices` |
| **Promo** | Konten halaman promo website (bukan diskon) | `index`/`add`/`edit`/`delete`/`detail` |
| **Coupon** | Kupon diskon invoice (`invoice.code_coupon`) | `index`/`settings`/`add`/`edit`/`del`, `cekcoupon` (validasi: is_active, periode, one_time, max_limit, usage_channel) |
| **Slider** | Carousel halaman depan (file `Slider.php`, tabel `slide`) | `index`/`add`/`edit`/`delete`, `toggleslide` |
| **Income** | Pemasukan kas | `index`, `kas`/`thismonth`, `add`/`edit`/`delete`, `category/*` (tabel `cat_income`), `addIncomePending`/`approve_pending_income`/`approve_selected`/`reject_selected_pending` (+FCM ke admin), `printincome`/`printrecap`/`recap`, `filter`, `export`, `uploadimport`, util `fixincome`/`deldouble`/`movebankselected`/`delselected` |
| **Expenditure** | Pengeluaran kas (mirror Income) | `index`/`filter`, `add`/`edit`/`delete`, `category/*` (`cat_expenditure`), `printexpenditure`, `getrecap`, `export` |
| **Finance** | Dasbor keuangan | `index`/`dashboard`/`dashboard_ym`, `income`/`incomepending`/`expenditure`, `report`/`get_debit_kredit_data` (`report_transaction`), `commission/*` (`commissions`), `regulatory/*` |
| **Report** | Laporan transaksi per rentang tanggal | `index`, `printreport` |
| **Partner** | Mitra internal (role) & eksternal (tabel `mitra-external`) | `index`/`internal`/`external`/`addexternal`/`edit`/`delete`, `dashboard`/`getprofit`, `customer`/`router`/`package`/`finance`/`profitsharing`, `bill`/`getApi` |
| **Member** | Portal pelanggan | `index`/`status`/`history`/`profile`/`account`/`changepassword`, `invoice`/`pay`/`confirmpayment`/`xcheckout`, `wallet`/`wallettopup`/`cancel_topup`/`walletpay`, `modem`, `openticket`/`tickethistory`, `speedtest`, `hotspot`/`buy_hotspot_voucher`, `testimoni` |
| **Sales** | Sales & komisi | `index`, `fee`/`commission`/`fee_customers`, `fee_setting`/`save_fee_setting` (`sales_fee_settings`), `apply_fee_to_invoices` (fee atas invoice lunas), `unsynced_customers`, `invoice_detail`/`export_invoice_detail` |
| **Supplier**/**Item**/**Vendor** | Gudang & vendor uplink | Supplier CRUD + `doc/*`; Item: stok `in`/`out`/`assets`/`purchase`, `type`/`unit`, dokumen; Vendor: `inet`/`addinet`/`editinet`/`delinet` (uplink bandwidth) |
| **Logs** | Log aktivitas & autentikasi | `index`/`get_logs_ajax`, `del`/`delete_selected`/`dellall` |
| **Master** | Data referensi | ODC/ODP (+import), `statuscustomer/*`, `paymentmethod/*`, `branddevice/*`, `script/*`, `mediaconnection/*` |

### 1.6 Komunikasi & Notifikasi
| Controller | Tujuan | Method publik utama |
|---|---|---|
| **Whatsapp** | Multi-vendor WA gateway (tabel `whatsapp`: Mobichat, Qontak, Qiscus, Bablast, WAblas, Starsender, MPWA, Ruangwa, Watsap, Minom, Fonnte, WeaGate, Ashento, Starbox; per-coverage via `coverage.coverage_wa`) | `index`, `setting`/`edit`, `testsend`/`cekconnection`, `webhook` (inbound + AI), `template`/`settemplate`/`createtemplate`/`rewrite_template_ai`, `group`/`sendgroup`, `report`/`lastweek`, `blast`/`sendblast` |
| **Telegram** | Bot customer-service (FrameBot; tabel `bot_telegram`) + Telecore WA gateway | command /start /whoami /help, notifikasi tagihan; Telecore: `sendtelecore()` via `scheduleTelecore()` |
| **Sms** | SMS gateway (tabel `sms_gateway`) | `sendsms`, `sendbillpaid`/`sendbillunpaid`/`sendbillinvoice`/`sendbillselected`, `sendduedate`/`sendbeforeduedate`/`resendbill`, `sendmessage`/`sendmessagecoverage` |
| **Email** | SMTP + batch (tabel `email`, interval di `other`) | `sendemail`, `scheduleEmail()` |
| **Schedule** | Worker cron terpusat (proteksi `key`+lisensi) | `scheduleWhatsapp`/`scheduleEmail`/`scheduleSms`/`scheduleTelegram`/`scheduleTelecore`/`scheduleBirthday`, `generatebill`, `isolir`/`isolirown`/`isolirmanual`/`recheckisolir`, `sendnow`/`resend`/`delpending`, `backupdatabase`, `createbillingva`/`updaterealtimeva`, `runner` |
| **Notification** | **Webhook Midtrans** (bukan pusat notifikasi) | `index()` — validasi SHA512, settlement/capture → invoice lunas + open-isolir + WA |
| **Fcmnotification** | Push FCM (tabel `fcm_device_tokens`, `fcm_notification_histories`) | `index`, `tokens`, `histories`, `templates`, `send`, `cleanup`, `sync` |

Fungsi kirim (helper `mywifi_helper.php`): `sendmsg`, `sendmsgbill`, `sendmsgpaid`, `sendmsgschedule`, `indo_tlp` (normalisasi ke 62). Template WA = kolom `text_*` di tabel `whatsapp` (20 template: text_bill, text_isolir, text_pay, text_payment, text_reminder, text_duedate, text_add_customer, text_checkout, text_verify, text_code_otp, text_forgot, text_reset_password, text_ticket_done, text_ticket_update, text_create_help, text_birthday, dll; placeholder `{name},{noservices},{user},{companyname},{slogan},{link},{email},{password}`).

### 1.7 Halaman Publik (Front.php, tanpa login)
`index` (landing: hero slider, section-packages, **cek tagihan interaktif**, section-hotspot, values, teasers, FAQ, app-promo) • `cekTagihan`/`view_bill` (cek by `no_services` atau no HP) • `bill`/`invoice`/`billthermal`/`debt` (invoice publik) • `coverage` (peta cakupan) • `hotspot` (beli voucher per router) • `checkout` (bayar invoice: pilih metode / Xendit / Moota) • `speedtest` • `usage`/`cekUsage` • `reset-pppoe/reset-hotspot/reset-standalone/reset-static/reset-usage` (self-reset) • `help` (buat tiket publik, `track`) • `produk`/`detailLayanan`/`faq` • `isolir` (redirect cron) • `apps` (manifest PWA) • `monitoring` (butuh key/sesi).

### 1.8 Lainnya
`Setting` (tabel `company` single-row: nama, alamat, ppn, timezone, logo; `bank`, `other` [toggle frontend, `key_apps`, interval WA/email], `terms`/`policy`, `bottelegram`, `backup`/`restore`, `commission`), `Help` (tiket: `addhelp`, `track`/`getticket`, `updatetiket`, `assignTechnicians`, `help_type`/`help_action`), `Documentation` (`api`, `openapi` JSON OpenAPI 3.0, artikel), `Livechat` (`widget`, HMAC-SHA256), `Email`, `Kpi` (hit counter), `Config` (setup DB), `LanguageSwitcher`, `Gsm`, `Indosat`, `Tukeur`, `Hioso`, `Hsairpo`, `Ggclink`, `Cdata`, `Midi`, `Telecore`, `Managerio` (akuntansi Manager.io), `WebsocketController`, `Rest`/`Serverside`/`Pagination`/`Ciqrcode`/`Format`/`Pdf`/`Template`/`Cache`/`Timezone`.

---

## 2. Alur Bisnis Kunci

### (a) Siklus tagihan
1. **Generate**: manual massal `Bill::generateBill()` → helper `generateBill()` (pelanggan aktif, filter coverage, cegah duplikat `remove_duplicate_invoice()`); atau terjadwal `Schedule::generatebill` (`sch_createbill`, tiap 15 mnt, metode `date_create`/`date_multi`/`due_date`); atau saat registrasi (`Customer::store` + `createbill`: full/prorata); atau manual `addBill()` (1..N bulan); atau dari draf (`addBillDraf` → `generateselected()`).
2. Nomor invoice: `ymd + 3 digit` (tabrakan → terakhir+1). Total dari tabel `services`; `amountuniq` = amount + `code_unique` − diskon.
3. Jatuh tempo: `inv_due_date` dari `customer.due_date` (mode `month_due_date` 0=bulan sama, 1=bulan depan); `date_isolir` = due_date + `max_due_isolir` hari (0 → = due_date).
4. **Isolir otomatis**: `Schedule::isolir`/`isolirown()` tiap 5–10 mnt (flag `sch_isolir`) — pelanggan `BELUM BAYAR` lewat `date_isolir` di-disable di Mikrotik (lihat §2e); WA `sendbillisolir`.
5. **Buka isolir**: helper `openisolir($no_services, $router_id)` (`mywifi_helper.php:9483`) — tolak jika masih ada `BELUM BAYAR` lewat `date_isolir` (kecuali force); via `Bill::openisolir()`, `Customer::openisolir()`, atau antrean `cronjobs` (tipe `openisolir`) dieksekusi `Cron::run()`.

### (b) Pembayaran
1. `Checkout::payment?invoice=X` → lengkapi detail + `fixamount()` → pilih gateway → buat transaksi (`payment_gateway_transaction`: vendor, external_id, reference, payment_url, status `UNPAID`) → redirect ke payment_url.
2. **Callback** (per gateway, §1.3) → verifikasi signature → `payment_gateway_transaction` → `PAID` → `invoice` → `SUDAH BAYAR` (guard idempotent `WHERE status != 'SUDAH BAYAR'`), `metode_payment='Payment Gateway'`, `date_payment=time()`, `date_paid=Y-m-d` → `INSERT income` (nominal=amount−disc_coupon, category=1, mode_payment='Payment Gateway') → WA `sendmsgpaid` + Telegram owner + FCM → komisi referrer (`commissions`) → point wallet → `openisolir()` → `maybe_generate_next_invoice_after_payment()` → `INSERT logs`.
3. Jalur lain: admin tandai lunas (`Bill::payment`), konfirmasi manual (`Member::confirmpayment` upload bukti → `confirm_payment` Pending → `Bill::confirmUpdate` → lunas), mutasi bank otomatis (cocokkan `amountuniq` via `bill_m->cekamountunique()`), bayar pakai saldo wallet, VA BNI.

### (c) Registrasi pelanggan baru
`Customer::add()` (form) → `store()` AJAX (validasi name, `no_services` unik, email unik) → `Customer_m::add()` (field §3) → auto-insert `services` (paket `package_item`) → opsional `createbill` (invoice pertama full/prorata/nextmonth) → opsional sinkron ke Mikrotik (buat PPP secret / hotspot user).

### (d) Voucher hotspot
`Hotspot::hotspot_generate_users` — kode `prefix+random` (default prefix `vc`, panjang 6, charset mix a-z+0-9; mode `rand` password beda, `same` password=kode) → `/ip/hotspot/user/add` (name, password, profile, limit-uptime, limit-bytes-total, comment `vc-`/`up-`) → template cetak (`hotspot_voucher_templates`: paper_size, html, css). Reseller: potong `reseller_wallet` otomatis (refund bila gagal). Bersih otomatis: `Cron::hotspot_auto_clean()` tiap 5–15 mnt.

### (e) Manajemen router Mikrotik
- **Koneksi**: tabel `router` (alias, ip_address, username, password, port default 8728, ros_version V6/V7, services API/REST); `Mikweb` (API biner) atau `ROS7Rest`.
- **PPP**: `addPppoeUser` → `/ppp/secret/add`; `delPppoeUser` → `/ppp/secret/remove`; `disablepppoeuser`/`enablepppoeuser` → `/ppp/secret/disable|enable`.
- **Hotspot user**: `addHotspotUser` → `/ip/hotspot/user/add`; disable/enable/delete sepadan.
- **Isolir** (`isolir()`, helper :9155) per `customer.mode_user`: PPPOE+action=0 → `/ppp/secret/disable` (+`/ppp/active/remove`); PPPOE+action=1+type_ip=1 → `/ip/firewall/address-list` list=EXPIRED; type_ip=0 → `/ppp/secret/set profile=EXPIRED`; Hotspot → `/ip/hotspot/user/disable` atau profile=EXPIRED; Standalone → `/interface/disable`; Static → filter `ISOLIR|<no_services>`.
- **Buka isolir** (`openisolir()`, :9483): enable secret/user, kembalikan profile dari `customer.user_profile`, hapus filter/address-list `ISOLIR|<no_services>`. **Kick**: `/ppp/active/remove` atau `/ip/hotspot/active/remove`.

---

## 3. Skema Database (tabel inti)

| Tabel | Kolom penting |
|---|---|
| `user` | id PK, name, email UNIQUE, password (hash), image, gender, codephone, phone, address, role_id, is_active, date_created (unix) |
| `role_group` | id, role_id, role_name, remark, profit_sharing |
| `role_management` | id, key, value, role_id, role_access_id |
| `customer` | customer_id PK, no_services (kunci bisnis, unik), name, email, no_wa, no_ktp, address, coverage FK, c_status (Aktif/Nonaktif/Wait/Free/Isolir), due_date, month_due_date, max_due_isolir, auto_isolir, dynamic_due_date, send_bill, ppn, codeunique, nomorcodeuniq, type_payment, router FK, user_mikrotik, user_profile, mode_user, action, type_ip, connection, olt, id_odc, id_odp, no_port_odp, mac_address, serial_number, mediaconnection, latitude, longitude, register_date, birth_date, createby, mitra, customer_mitra, sales_id, sales_referral_code, referrer, created (unix) |
| `invoice` | invoice_id PK, invoice (no faktur), month, year, no_services FK, status (BELUM BAYAR/SUDAH BAYAR), subtotal, amount, amountuniq, code_unique, disc_coupon, code_coupon, i_ppn, inv_ppn, inv_due_date (date), date_isolir (date), date_payment (unix), date_paid, create_by, metode_payment, created (unix), reference, payment_url, x_external_id, x_method, x_amount, order_id, token, va_status, transaction_time, expired, flag WA: send_isolir_whatsapp, send_due, send_before_due, send_paid |
| `invoice_detail` | detail_id PK, invoice_id FK, item_id FK package_item, category_id, qty, disc, price, total, remark, d_month, d_year, d_no_services |
| `services` | services_id PK, no_services FK, item_id FK, category_id, qty, disc, price, total, remark, services_create |
| `package_item` | p_item_id PK, name, price, is_active, public, category_id FK, description, picture, date_created, create_by, package_mitra |
| `package_category` | p_category_id PK, name, description, date_created, date_updated |
| `router` | id PK, alias, ip_address, username, password, port (8728), ros_version (V6/V7), services (API/REST), user_manager, hotspot_manager, is_active, create_by, voucher_prefix, voucher_length, voucher_mode, voucher_charset, auto_delete_expired, auto_delete_mode, auto_delete_scope, auto_delete_unsold_days |
| `hotspot_packages` | id PK, router_id FK, profile_name, name, customer_price, reseller_price, validity, time_limit, data_limit, speed_limit, shared_users, expire_mode, description, is_active, created_at, updated_at (+ `hotspot_package_resellers`, `hotspot_voucher_templates`: id, name, paper_size, html, css, is_active) |
| `olt` | id PK, alias, ip_address, api_key, bridge_olt, username, password, port, vendor (HSGQ/CDATA/VSOL/Hioso/ZTE), type |
| `m_odc` | id_odc PK, code_odc UNIQUE, coverage_odc, no_port_olt, color_tube_fo, no_pole, latitude, longitude, total_port, remark, lock_odc, document, created (+ `odc_doc`) |
| `m_odp` | id_odp PK, code_odp UNIQUE, code_odc FK, coverage_odp, no_port_odc, color_tube_fo, no_pole, latitude, longitude, total_port, remark, document, created (+ `odp_doc`) |
| `income` | income_id PK, nominal, date_payment, category FK cat_income, coverage FK, mode_payment, bank_id FK, remark, create_by, created, invoice_id, no_services (+ `income_pending` antrean approval, `cat_income`, `cat_expenditure`, `bank`, `report_transaction`) |
| `expenditure` | expenditure_id PK, nominal, date_payment, remark, category FK, mode_payment, bank_id, create_by, created |
| `product` | id PK, package_item_id FK, is_visible, sort_order, date_created (name/desc via join) |
| `promo` | promo_id PK, name, picture, remark, slug, description |
| `coupon` | coupon_id PK, code, is_active, is_visible, usage_channel (web/app/both), active_start_date, active_end_date, one_time, percent, max_limit, max_active, remark, created |
| `coverage` | coverage_id PK, c_name, code_area UNIQUE, address, radius (meter), latitude, longitude, comment, public, create_by, coverage_mitra, coverage_wa (+ `cover_operator`, `cover_package`) |
| `slide` | slide_id PK, name, picture, link, description |
| `company` | id=1, company_name, sub_name, email, apps_name, address, owner, admin_fee, ppn, timezone, whatsapp, phone, logo, favicon, expired, ... |
| `va_transaction` | id PK, vendor, va_name, virtual_account, trx_id, no_services, status (UNPAID/PAID/INACTIVE/NOT FOUND), va_expired, invoice, amount, created |
| `confirm_payment` | confirm_id PK, invoice_id, no_services, metode_payment, date_payment, status (Pending/Terverifikasi), remark, date_created, picture |
| `mitra-external` | id PK, alias, api_key, url, remark, pph, tax, bhp, uso, admin, slug, created |
| `sales` / `sales_fee_settings` | sales_id FK user, fee_amount, created_at, updated_at |
| `wallet_account` | id PK, customer_id NULL, user_id NULL, role_id, account_type (customer/user), balance DECIMAL(16,2), points BIGINT, last_transaction_at, created_at, updated_at |
| `wallet_transaction` | id PK, wallet_account_id FK, direction (credit/debit), type, balance_amount, point_amount, balance_before/after, points_before/after, reference_type, reference_id, description, meta, created_by, created_at |
| `payment_gateway` | id PK, vendor, api_key, server_key, client_key, kodemerchant, is_active, mode, expired, admin_fee, domain_api JSON |
| `payment_gateway_transaction` | id PK, vendor, external_id, method, customer_id, no_services, invoice, reference, payment_url, transaction_time, expired, status_payment (UNPAID/PAID/EXPIRED/FAILED), amount, paid_at, wallet_owner_type |
| `whatsapp` | id PK, vendor, is_active, domain_api, token, template, interval_message, text_* (20 template), ai_auto_template, ai_prompt |
| `whatsapp_schedule` | id PK, target, message, status (pending/sent/failed), vendor, type_message, type_bill (sendbill/payment/sendbillisolir/reminder/duedate), customer_id, invoice_id, id_wa, template_key, payload, placeholders, priority, remark, date_created, date_excute NULL |
| `bot_telegram` | id PK, vendor, is_active, token, username_bot, username_owner, id_group_teknisi, id_telegram_owner, telecore_* (token/session/host/chatid), telecore_text_* |
| `sms_gateway` | id PK, sms_vendor, sms_api_key, sms_sender, text_bill/text_payment/text_duedate/text_add_customer, is_active |
| `cronjobs` | id PK, type (openisolir), data JSON, status (pending/running/done/failed), retry_count, last_attempt_at, error_message, created_at |
| `logs` | id PK, date_log, datetime, category (Activity/Autentication), name, role_id, user_id, remark |
| `help` | id PK, no_ticket, ticket_password, no_services, status, (+ `help_type`, `help_action`) |
| `commissions` | invoice_id, customer_id, amount, type, remark, referrer_id, created_at |
| `fcm_device_tokens` / `fcm_notification_histories` | token, user_id, role_id, server_url; riwayat + response_payload |

Tipe perkiraan: ID/flag/unix-timestamp = INT; nama/nomor/status = VARCHAR/TEXT; amount/price = DECIMAL/INT; tanggal invoice = DATE; created_at = DATETIME.

---

## 4. Payment Gateway — ringkasan
Didukung: **Midtrans (Snap)**, **Xendit** (Invoice/VA/eWallet/Retail), **Duitku**, **Tripay**, **Doku** (Alfa/Indomaret O2O), **iPaymu**, **Indosat**, **Tukeur**, **BNI e-Collection VA direct** (`Va` + `BniEnc`; BRIVA wrapper siap), **Moota** + **Mesin Otomatis** (mutasi bank, cocokkan `amountuniq`), **Flip** (hanya test sandbox, tidak dipakai). Library: `libraries/Midtrans.php`, `libraries/Veritrans.php`, `libraries/BniEnc.php`, `libraries/Bri.php`, `libraries/Mootaa.php`, Composer SDK `Xendit\Xendit`; sisanya cURL murni. Helper: `helpers/payment_gateway_helper.php`, `helpers/va_helper.php`, `helpers/wallet_helper.php`.

## 5. Cron Jobs
| Endpoint | Fungsi | Jadwal |
|---|---|---|
| `cron/run` (+`retry_failed_jobs`) | Eksekusi antrean `cronjobs` (tipe `openisolir`), retry ≤3 | dipanggil eksternal/CLI |
| `cron/router_olt_check` | Monitor konektivitas router & OLT → notifikasi FCM | tiap ±5 mnt |
| `cron/hotspot_auto_clean` | Hapus voucher hotspot expired di MikroTik | tiap 5–15 mnt |
| `schedule/scheduleWhatsapp` (+Email/Sms/Telegram/Telecore/Birthday) | Worker antrean `whatsapp_schedule` status pending | menitan |
| `schedule/generatebill` | Generate tagihan bulanan massal | tiap 15 mnt (00:01–23:00) |
| `schedule/isolir`, `isolirown`, `isolirmanual`, `recheckisolir` | Isolir otomatis pelanggan nunggak | tiap 5–10 mnt |
| `schedule/backupdatabase`, `delldoublebill`, `fixduedate`, `createbillingva`, `updaterealtimeva`, `countusage` | Maintenance & util | terjadwal/manual |

Proteksi: `?key=<key_apps>` (tabel `other`) atau CLI.

## 6. Notifikasi — trigger
| Kanal | Trigger |
|---|---|
| **WhatsApp** (multi-vendor, template `text_*`) | Invoice baru (`sendbill`), pembayaran lunas (`payment`), isolir (`sendbillisolir`), reminder/duedate (`duedate`/`reminder`), tiket (create/update/done), ulang tahun, reset password, OTP, registrasi, checkout — via instant (`sendbillpaid`/`sendbillunpaid`/`blast`) atau antrean `whatsapp_schedule` |
| **Telegram** | Konfirmasi pembayaran ke owner (+tombol inline), notifikasi tagihan ke pelanggan, event mutasi bank |
| **SMS** | Invoice baru, jatuh tempo (H- & H), pembayaran lunas, broadcast per coverage |
| **Email** | Verifikasi, lupa password, invoice (`create_invoice`), pembayaran — batch via `scheduleEmail()` |
| **FCM push** | Router/OLT offline (`router_olt_check`), `income_pending` butuh approval, event tagihan (`dispatch_fcm_textbill`) |

## 7. Halaman Publik (Front.php)
Landing: hero slider, daftar paket, **cek tagihan interaktif**, section hotspot, values, teasers, FAQ, app-promo • Cek tagihan (by no_services/no HP) • Invoice publik (A4/thermal) & sisa hutang • Peta coverage • Beli voucher hotspot • Checkout bayar invoice • Speedtest • Cek usage kuota • Self-reset (PPPoE/hotspot/standalone/static/usage) • Tiket bantuan publik + tracking • Katalog produk/layanan + FAQ • Manifest PWA.

---

## Catatan penting untuk rebuild
1. **Tidak ada generate invoice via `Cron.php`** — generate via `Schedule::generatebill`; isolir via `Schedule::isolir/isolirown`; `Cron.php` hanya antrean `openisolir` + monitoring + bersih voucher.
2. `Notification.php` = webhook Midtrans, bukan pusat notifikasi.
3. `Confirm_payment.php` tidak ada — di `Bill.php`.
4. File controller `Slider.php` (class `Slider`), tabel `slide`.
5. Voucher hotspot **tidak disimpan di DB** — hanya hidup di MikroTik; yang tersimpan hanya paket & template.
6. Cek coverage wilayah **100% client-side** (Leaflet), backend hanya serve JSON.
7. Isolir Mikrotik punya 5 mode (`mode_user`: PPPOE/Hotspot/Static/Standalone/Binding) × 2 action (disable vs profile EXPIRED) — logika inti ada di helper `openisolir`/`isolir` (`mywifi_helper.php`).
8. Multi-tenancy mitra: `package_mitra=1` (paket), `coverage_mitra`, `customer_mitra`, tabel `mitra-external` (pakai tanda hubung).
9. Semua timestamp operasional memakai `company.timezone`; banyak kolom tanggal berupa **unix timestamp INT**, bukan DATETIME.
10. Lisensi: beberapa fitur (mis. `scheduleWhatsapp`) diblokir bila status lisensi ≠ `match` — untuk rebuild, abaikan/hapus mekanisme lisensi.

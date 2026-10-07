-- GenISP seed v1.0.0
-- Jalankan SETELAH 001_schema.sql

-- company
insert into company (id, name, tagline, address, phone, email, website, primary_color, secondary_color, invoice_prefix)
values (1, 'GenISP', 'Internet Cepat & Stabil', 'Jl. Contoh No. 1, Indonesia', '081234567890', 'cs@genisp.id', 'https://genisp.id', '#0d627c', '#f97316', 'INV')
on conflict (id) do nothing;

-- roles
insert into roles (name, permissions) values
  ('superadmin', '["*"]'),
  ('admin', '["dashboard","customers","invoices","packages","routers","hotspot","ftth","finance","reports","settings","users"]'),
  ('cs', '["dashboard","customers","invoices","confirm_payments"]'),
  ('teknisi', '["dashboard","customers","routers","ftth","coverage"]'),
  ('sales', '["dashboard","customers"]')
on conflict (name) do nothing;

-- superadmin: admin@genisp.id / admin123  (GANTI SETELAH LOGIN PERTAMA)
insert into users (name, email, password_hash, role, is_active)
values ('Administrator', 'admin@genisp.id', '$2b$10$3s4x6f.nUUBs/TPxaf8w4O4dyybxjO4CpW1vRTikny8eSI4A5oZyS', 'superadmin', true)
on conflict (email) do nothing;

-- kategori keuangan
insert into income_categories (name) values
  ('Tagihan Internet'), ('Penjualan Voucher'), ('Penjualan Produk'), ('Lainnya')
on conflict (name) do nothing;

insert into expenditure_categories (name) values
  ('Operasional'), ('Gaji'), ('Perangkat'), ('Bandwidth'), ('Lainnya')
on conflict (name) do nothing;

-- paket contoh
insert into packages (name, category, price, speed_down, speed_up, description, is_active) values
  ('Basic 10 Mbps', 'pppoe', 100000, '10 Mbps', '5 Mbps', 'Paket hemat untuk browsing & sosmed', true),
  ('Standard 20 Mbps', 'pppoe', 150000, '20 Mbps', '10 Mbps', 'Paket keluarga untuk streaming HD', true),
  ('Pro 50 Mbps', 'pppoe', 250000, '50 Mbps', '25 Mbps', 'Untuk gamer & WFH', true)
on conflict do nothing;

-- settings default
insert into settings (key, value) values
  ('wa_reminder_h3', 'Halo {nama}, tagihan internet {periode} sebesar {nominal} jatuh tempo {jatuh_tempo}. Kode: {kode}. Bayar via aplikasi atau transfer. Terima kasih - {perusahaan}'),
  ('wa_reminder_overdue', 'Halo {nama}, tagihan {kode} periode {periode} sebesar {nominal} SUDAH JATUH TEMPO. Segera lakukan pembayaran agar layanan tidak terisolir. - {perusahaan}'),
  ('wa_paid_thanks', 'Terima kasih {nama}, pembayaran {kode} sebesar {nominal} telah kami terima. Layanan aktif kembali. - {perusahaan}'),
  ('invoice_due_day', '10'),
  ('auto_isolir_days', '7')
on conflict (key) do nothing;

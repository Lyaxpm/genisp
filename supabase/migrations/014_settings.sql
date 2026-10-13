-- 012_settings.sql — master referensi + bank untuk stream S13 (idempoten).
-- Tabel baru: payment_methods, customer_statuses, device_brands, connection_media, banks.

-- ============ METODE PEMBAYARAN ============
create table if not exists payment_methods (
  id serial primary key,
  name text not null unique,
  remark text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into payment_methods (name, remark, is_system) values
  ('Cash', 'Metode bawaan sistem', true),
  ('Transfer', 'Metode bawaan sistem', true)
on conflict (name) do nothing;

-- ============ STATUS PELANGGAN ============
create table if not exists customer_statuses (
  id serial primary key,
  status text not null unique,
  remark text not null default '',
  active_bill boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into customer_statuses (status, remark, active_bill) values
  ('Aktif', 'Aktif Berlangganan', true),
  ('Non-Aktif', 'Berhenti Berlangganan', false),
  ('Menunggu', 'Calon pelanggan / Pelanggan register mandiri', false),
  ('Free', 'Pelanggan gratis', false)
on conflict (status) do nothing;

-- ============ MEREK PERANGKAT ============
create table if not exists device_brands (
  id serial primary key,
  name text not null unique,
  remark text not null default '',
  onu_type text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ MEDIA KONEKSI ============
create table if not exists connection_media (
  id serial primary key,
  name text not null unique,
  remark text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ BANK ============
create table if not exists banks (
  id serial primary key,
  name text not null,
  no_rek text not null default '',
  owner text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

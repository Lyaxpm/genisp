-- ============ STREAM S8: Hotspot sub-fitur ============
-- Template voucher, lokasi hotspot, topup reseller, + kolom harga paket (reseller).
-- Idempoten: aman dijalankan ulang.

-- Kolom harga bertingkat untuk hotspot_packages (dipakai route vouchers yang sudah ada).
alter table if exists hotspot_packages
  add column if not exists customer_price numeric(14,2) not null default 0;
alter table if exists hotspot_packages
  add column if not exists reseller_price numeric(14,2);

-- Sinkronkan harga lama (price) ke customer_price bila masih 0.
update hotspot_packages
  set customer_price = price
  where customer_price = 0 and price > 0;

-- ============ TEMPLATE VOUCHER ============
create table if not exists hotspot_voucher_templates (
  id serial primary key,
  name text not null,
  paper_size text not null default 'A4', -- A4|A5|80mm|58mm
  html_body text not null default '',
  is_active boolean not null default false,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ LOKASI HOTSPOT ============
create table if not exists hotspot_locations (
  id serial primary key,
  name text not null,
  router_id int references routers(id) on delete cascade,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hotspot_locations_router
  on hotspot_locations(router_id);

-- ============ TOPUP RESELLER (pengajuan, status pending/approved/rejected) ============
create table if not exists reseller_topups (
  id serial primary key,
  reseller_id int not null references partners(id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null default 'pending', -- pending|approved|rejected
  note text,
  processed_by int references users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reseller_topups_status
  on reseller_topups(status);

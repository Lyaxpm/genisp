-- GenISP schema v1.0.0 (Postgres / Supabase)
-- Rebuild dari PTA (CodeIgniter) ke Next.js full-stack. Tanpa license.

-- ============ EXTENSIONS ============
create extension if not exists "pgcrypto";

-- ============ USERS & ROLES ============
create table if not exists roles (
  id serial primary key,
  name text not null unique,
  permissions jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'cs', -- superadmin|admin|teknisi|cs|sales
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ COMPANY & SETTINGS ============
create table if not exists company (
  id int primary key default 1,
  name text not null default 'GenISP',
  tagline text,
  address text,
  phone text,
  email text,
  website text,
  logo_url text,
  primary_color text not null default '#0d627c',
  secondary_color text not null default '#f97316',
  invoice_prefix text not null default 'INV',
  constraint company_singleton check (id = 1)
);

create table if not exists settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- ============ PACKAGES ============
create table if not exists packages (
  id serial primary key,
  name text not null,
  category text not null default 'pppoe', -- pppoe|hotspot|dedicated
  price numeric(14,2) not null default 0,
  speed_down text, -- "20 Mbps"
  speed_up text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ ROUTERS (MikroTik) ============
create table if not exists routers (
  id serial primary key,
  name text not null,
  host text not null,
  api_port int not null default 8728,
  username text not null,
  password_enc text not null default '', -- base64; ganti dengan KMS di produksi
  location text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ CUSTOMERS ============
create table if not exists customers (
  id serial primary key,
  code text not null unique,              -- no_services / ID pelanggan
  name text not null,
  email text,
  phone text not null,
  password_hash text,                    -- untuk login portal member
  address text,
  no_ktp text,
  birth_date date,
  package_id int references packages(id) on delete set null,
  router_id int references routers(id) on delete set null,
  pppoe_user text,
  pppoe_pass text,
  connection_type text not null default 'pppoe', -- pppoe|hotspot|fo
  status text not null default 'pending', -- pending|aktif|isolir|nonaktif
  due_day int not null default 10,        -- tanggal jatuh tempo tiap bulan
  auto_isolir boolean not null default true,
  latitude numeric(10,7),
  longitude numeric(10,7),
  odp_id int,                             -- ref ke odps
  odp_port int,
  mac_address text,
  sales_id int references users(id) on delete set null,
  partner_id int,                         -- ref ke partners
  notes text,
  registered_at timestamptz not null default now(),
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_customers_phone on customers(phone);
create index if not exists idx_customers_status on customers(status);

-- ============ INVOICES & PAYMENTS ============
create table if not exists invoices (
  id serial primary key,
  code text not null unique,              -- INV/2026/10/0001
  customer_id int not null references customers(id) on delete cascade,
  period text not null,                   -- YYYY-MM
  amount numeric(14,2) not null default 0,
  unique_amount numeric(14,2) not null default 0, -- kode unik (opsional)
  status text not null default 'unpaid',  -- unpaid|paid|expired|cancelled
  due_date date not null,
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoices_customer on invoices(customer_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_period on invoices(period);

create table if not exists invoice_items (
  id serial primary key,
  invoice_id int not null references invoices(id) on delete cascade,
  description text not null,
  qty numeric(12,2) not null default 1,
  price numeric(14,2) not null default 0
);

create table if not exists payments (
  id serial primary key,
  invoice_id int not null references invoices(id) on delete cascade,
  gateway text not null default 'manual', -- manual|xendit|midtrans|tripay|duitku|doku|ipaymu|flip
  external_id text,
  amount numeric(14,2) not null,
  status text not null default 'pending', -- pending|paid|failed|expired
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_external on payments(gateway, external_id);

-- konfirmasi pembayaran manual (upload bukti)
create table if not exists confirm_payments (
  id serial primary key,
  invoice_id int not null references invoices(id) on delete cascade,
  sender_name text not null,
  amount numeric(14,2) not null,
  proof_url text,
  status text not null default 'pending', -- pending|approved|rejected
  reviewed_by int references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ HOTSPOT ============
create table if not exists hotspot_packages (
  id serial primary key,
  name text not null,
  price numeric(14,2) not null default 0,
  duration_hours int not null default 24,
  profile text,                           -- user profile di mikrotik
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists vouchers (
  id serial primary key,
  code text not null unique,
  hotspot_package_id int not null references hotspot_packages(id) on delete cascade,
  router_id int references routers(id) on delete set null,
  status text not null default 'active', -- active|used|expired
  used_at timestamptz,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ FTTH (OLT -> ODC -> ODP) ============
create table if not exists olts (
  id serial primary key,
  name text not null,
  brand text,                             -- zte|vsol|hioso|hsairpo|telecore
  host text,
  location text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists odcs (
  id serial primary key,
  olt_id int references olts(id) on delete set null,
  name text not null,
  capacity int not null default 8,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz not null default now()
);

create table if not exists odps (
  id serial primary key,
  odc_id int references odcs(id) on delete set null,
  name text not null,
  capacity int not null default 8,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz not null default now()
);

-- ============ COVERAGE ============
create table if not exists coverages (
  id serial primary key,
  name text not null,
  description text,
  area jsonb,                             -- GeoJSON polygon / circle
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ FINANCE ============
create table if not exists income_categories (
  id serial primary key,
  name text not null unique
);
create table if not exists expenditure_categories (
  id serial primary key,
  name text not null unique
);

create table if not exists incomes (
  id serial primary key,
  date date not null default current_date,
  category_id int references income_categories(id) on delete set null,
  amount numeric(14,2) not null,
  description text,
  payment_method text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists expenditures (
  id serial primary key,
  date date not null default current_date,
  category_id int references expenditure_categories(id) on delete set null,
  amount numeric(14,2) not null,
  description text,
  payment_method text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ KATALOG & PROMO ============
create table if not exists products (
  id serial primary key,
  name text not null,
  price numeric(14,2) not null default 0,
  stock int not null default 0,
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists promos (
  id serial primary key,
  title text not null,
  description text,
  image_url text,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id serial primary key,
  code text not null unique,
  discount_type text not null default 'percent', -- percent|fixed
  discount_value numeric(14,2) not null default 0,
  max_use int not null default 1,
  used_count int not null default 0,
  valid_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists slides (
  id serial primary key,
  title text,
  subtitle text,
  image_url text,
  link_url text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table if not exists services (
  id serial primary key,
  title text not null,
  description text,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ============ PARTNER / RESELLER ============
create table if not exists partners (
  id serial primary key,
  name text not null,
  email text,
  phone text not null,
  password_hash text,
  commission_percent numeric(5,2) not null default 10,
  wallet_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id serial primary key,
  partner_id int not null references partners(id) on delete cascade,
  type text not null, -- credit|debit
  amount numeric(14,2) not null,
  description text,
  created_at timestamptz not null default now()
);

-- ============ NOTIFIKASI & LOG ============
create table if not exists notifications (
  id serial primary key,
  channel text not null, -- whatsapp|telegram|sms|email
  recipient text not null,
  message text not null,
  status text not null default 'queued', -- queued|sent|failed
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id serial primary key,
  user_id int references users(id) on delete set null,
  action text not null,
  detail text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_logs_created on activity_logs(created_at desc);

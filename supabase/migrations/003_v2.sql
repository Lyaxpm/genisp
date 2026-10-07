-- GenISP schema v2.0.0 — modul lanjutan (tanpa terkecuali dari PTA)
-- Jalankan SETELAH 002_seed.sql

-- ============ WALLET (pelanggan & reseller) ============
create table if not exists wallet_accounts (
  id serial primary key,
  owner_type text not null,              -- customer|partner
  owner_id int not null,
  balance numeric(14,2) not null default 0,
  points bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);

create table if not exists wallet_ledger (
  id serial primary key,
  wallet_id int not null references wallet_accounts(id) on delete cascade,
  direction text not null,               -- credit|debit
  amount numeric(14,2) not null,
  balance_after numeric(14,2) not null,
  reference_type text,                   -- topup|invoice_payment|voucher_purchase|adjust|refund
  reference_id int,
  description text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_ledger_wallet on wallet_ledger(wallet_id);

create table if not exists wallet_topups (
  id serial primary key,
  wallet_id int not null references wallet_accounts(id) on delete cascade,
  amount numeric(14,2) not null,
  gateway text not null default 'manual',
  external_id text,
  status text not null default 'pending', -- pending|paid|failed|expired
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ============ HELPDESK / TIKET ============
create table if not exists help_types (
  id serial primary key,
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists help_tickets (
  id serial primary key,
  ticket_no text not null unique,        -- TIX-20261008-0001
  customer_id int references customers(id) on delete set null,
  name text not null,
  phone text not null,
  subject text not null,
  type_id int references help_types(id) on delete set null,
  message text not null,
  status text not null default 'open',   -- open|process|done|closed
  priority text not null default 'normal', -- low|normal|high
  assigned_to int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_help_tickets_status on help_tickets(status);

create table if not exists help_replies (
  id serial primary key,
  ticket_id int not null references help_tickets(id) on delete cascade,
  author_type text not null,              -- staff|customer
  author_id int,
  author_name text,
  message text not null,
  created_at timestamptz not null default now()
);

-- ============ SALES & KOMISI ============
create table if not exists sales_fees (
  id serial primary key,
  name text not null,
  type text not null default 'percent',  -- percent|fixed
  value numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists commissions (
  id serial primary key,
  invoice_id int references invoices(id) on delete set null,
  customer_id int references customers(id) on delete set null,
  sales_id int references users(id) on delete set null,
  amount numeric(14,2) not null,
  status text not null default 'pending', -- pending|paid
  notes text,
  created_at timestamptz not null default now()
);

-- ============ GUDANG / INVENTARIS ============
create table if not exists suppliers (
  id serial primary key,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists item_types (
  id serial primary key,
  name text not null unique
);

create table if not exists items (
  id serial primary key,
  name text not null,
  type_id int references item_types(id) on delete set null,
  unit text not null default 'pcs',
  stock int not null default 0,
  buy_price numeric(14,2) not null default 0,
  sell_price numeric(14,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists stock_moves (
  id serial primary key,
  item_id int not null references items(id) on delete cascade,
  direction text not null,                -- in|out
  qty int not null,
  ref_type text,                         -- purchase|sale|adjust|install
  ref_id int,
  notes text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists purchases (
  id serial primary key,
  supplier_id int references suppliers(id) on delete set null,
  date date not null default current_date,
  total numeric(14,2) not null default 0,
  notes text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists purchase_items (
  id serial primary key,
  purchase_id int not null references purchases(id) on delete cascade,
  item_id int not null references items(id) on delete cascade,
  qty int not null,
  price numeric(14,2) not null
);

create table if not exists vendors (
  id serial primary key,
  name text not null,
  service text,                           -- uplink internet
  bandwidth text,
  price numeric(14,2) not null default 0,
  contact text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ KUPON: pemakaian ============
create table if not exists coupon_usages (
  id serial primary key,
  coupon_id int not null references coupons(id) on delete cascade,
  invoice_id int references invoices(id) on delete set null,
  customer_id int references customers(id) on delete set null,
  discount numeric(14,2) not null,
  created_at timestamptz not null default now()
);

-- ============ NOTIFIKASI infra ============
create table if not exists fcm_tokens (
  id serial primary key,
  owner_type text not null,               -- staff|customer
  owner_id int not null,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists message_templates (
  key text primary key,                   -- mis. wa_bill, sms_duedate, email_invoice
  channel text not null,                  -- whatsapp|sms|email|telegram
  title text,
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- ============ PETA ============
create table if not exists map_cables (
  id serial primary key,
  name text not null,
  color text not null default '#0d627c',
  path jsonb not null default '[]',       -- [[lat,lng],...]
  notes text,
  created_at timestamptz not null default now()
);

-- ============ RBAC granular ============
create table if not exists role_permissions (
  role text not null,
  menu_key text not null,
  allowed boolean not null default true,
  primary key (role, menu_key)
);

-- ============ MASTER niche ============
create table if not exists modems (
  id serial primary key,
  customer_id int references customers(id) on delete set null,
  brand text,
  serial_number text,
  mac_address text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists gsm_users (
  id serial primary key,
  name text not null,
  phone text not null,
  operator text,
  quota_mb int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists voip_numbers (
  id serial primary key,
  number text not null unique,
  customer_id int references customers(id) on delete set null,
  password text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists onu_devices (
  id serial primary key,
  olt_id int references olts(id) on delete set null,
  pon text,
  onu_no text,
  serial_number text,
  name text,
  status text not null default 'unknown',
  rx_power text,
  updated_at timestamptz not null default now()
);

-- ============ INCOME PENDING (approval) ============
create table if not exists income_pending (
  id serial primary key,
  date date not null default current_date,
  category_id int references income_categories(id) on delete set null,
  amount numeric(14,2) not null,
  description text,
  payment_method text,
  status text not null default 'pending', -- pending|approved|rejected
  created_by int references users(id) on delete set null,
  reviewed_by int references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============ SEED v2 ============
insert into help_types (name) values
  ('Gangguan Internet'), ('Pemasangan Baru'), ('Pertanyaan Tagihan'), ('Lainnya')
on conflict (name) do nothing;

insert into message_templates (key, channel, title, body) values
  ('wa_bill', 'whatsapp', 'Tagihan Baru', 'Halo {nama}, tagihan internet {periode} sebesar {nominal} telah terbit. Kode: {kode}, jatuh tempo {jatuh_tempo}. - {perusahaan}'),
  ('wa_paid', 'whatsapp', 'Pembayaran Diterima', 'Terima kasih {nama}, pembayaran {kode} sebesar {nominal} telah kami terima. - {perusahaan}'),
  ('wa_isolir', 'whatsapp', 'Layanan Diisolir', 'Halo {nama}, layanan internet Anda diisolir karena tagihan {kode} belum dibayar. Segera bayar untuk aktivasi kembali. - {perusahaan}'),
  ('sms_duedate', 'sms', 'Jatuh Tempo', 'Tagihan {kode} sebesar {nominal} jatuh tempo {jatuh_tempo}. - {perusahaan}'),
  ('email_invoice', 'email', 'Tagihan Internet {periode}', 'Halo {nama}, tagihan {kode} periode {periode} sebesar {nominal}, jatuh tempo {jatuh_tempo}.')
on conflict (key) do nothing;

insert into settings (key, value) values
  ('ppn_percent', '11'),
  ('wa_vendor', 'generic'),
  ('sms_enabled', '0'),
  ('email_enabled', '0'),
  ('telegram_enabled', '0')
on conflict (key) do nothing;

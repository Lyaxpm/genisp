-- STREAM S6: billing sub-fitur (draft invoice, kode unik, debt/piutang,
-- receipt template, profit sharing runs). Idempoten: aman dijalankan ulang.

-- ---------- kolom baru di invoices ----------
alter table invoices add column if not exists unique_code int not null default 0;
alter table invoices add column if not exists discount numeric(14,2) not null default 0;
-- unique_amount sudah ada sejak 001 (total bayar setelah kode unik).

-- ---------- draft invoice ----------
create table if not exists invoice_drafts (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  period text not null,                       -- YYYY-MM
  amount numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  unique_code int not null default 0,
  due_date date,
  notes text,
  status text not null default 'draft',       -- draft|finalized|cancelled
  finalized_invoice_id int references invoices(id) on delete set null,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_invoice_drafts_customer on invoice_drafts(customer_id);
create index if not exists idx_invoice_drafts_status on invoice_drafts(status);
create index if not exists idx_invoice_drafts_period on invoice_drafts(period);

create table if not exists invoice_draft_items (
  id serial primary key,
  draft_id int not null references invoice_drafts(id) on delete cascade,
  description text not null,
  qty numeric(12,2) not null default 1,
  price numeric(14,2) not null default 0
);
create index if not exists idx_invoice_draft_items_draft on invoice_draft_items(draft_id);

-- ---------- piutang / debt ----------
create table if not exists debts (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  note text,
  status text not null default 'unpaid',      -- unpaid|partial|paid|cancelled
  due_date date,
  paid_at timestamptz,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_debts_customer on debts(customer_id);
create index if not exists idx_debts_status on debts(status);

create table if not exists debt_payments (
  id serial primary key,
  debt_id int not null references debts(id) on delete cascade,
  amount numeric(14,2) not null,
  payment_method text not null default 'manual',
  notes text,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_debt_payments_debt on debt_payments(debt_id);

-- ---------- template struk ----------
create table if not exists receipt_templates (
  id serial primary key,
  name text not null,
  kind text not null default 'thermal',       -- thermal|a4
  body_html text not null,
  is_default boolean not null default false,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- template struk 58mm bawaan (placeholder {{nama}} diisi saat cetak)
insert into receipt_templates (name, kind, body_html, is_default)
select 'Struk 58mm bawaan', 'thermal',
'================================
{{company_name}}
================================
No      : {{invoice_code}}
Tgl     : {{issued_at}}
Pelanggan: {{customer_name}}
Periode : {{period}}
Jatuh tempo: {{due_date}}
--------------------------------
Tagihan : {{amount}}
Diskon  : {{discount}}
Kode unik: {{unique_code}}
--------------------------------
TOTAL   : {{unique_amount}}
--------------------------------
Status  : {{status}}
{{paid_note}}
Terima kasih atas pembayaran Anda.
================================',
true
where not exists (select 1 from receipt_templates where is_default and kind = 'thermal');

-- ---------- log bagi hasil partner ----------
create table if not exists profit_sharing_runs (
  id serial primary key,
  period text not null,                        -- YYYY-MM
  total_base numeric(14,2) not null default 0,
  total_shared numeric(14,2) not null default 0,
  details jsonb not null default '[]'::jsonb,
  created_by int references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_profit_sharing_runs_period on profit_sharing_runs(period);

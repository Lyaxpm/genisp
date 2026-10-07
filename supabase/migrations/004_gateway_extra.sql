-- GenISP schema v2.1 — tabel transaksi VA (BNI e-Collection direct)
-- Jalankan SETELAH 003_v2.sql

create table if not exists va_transaction (
  id serial primary key,
  vendor text not null default 'bni',
  va_number text not null unique,
  customer_name text,
  trx_id text,                               -- disamakan dengan payments.external_id
  invoice_id int references invoices(id) on delete set null,
  amount numeric(14,2) not null,
  status text not null default 'UNPAID',     -- UNPAID|PAID|EXPIRED
  expired_at timestamptz,
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_va_transaction_trx on va_transaction(trx_id);

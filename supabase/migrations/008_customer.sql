-- ============ 008: CUSTOMER SUB-FITUR (recycle bin, dokumen, flag sinkron router) ============
-- Idempoten: aman dijalankan ulang.

-- Soft delete untuk recycle bin
alter table customers add column if not exists deleted_at timestamptz null;
create index if not exists idx_customers_deleted_at on customers(deleted_at);

-- Flag kapan terakhir pelanggan tersinkron ke router (MikroTik / OLT)
alter table customers add column if not exists router_synced_at timestamptz null;
create index if not exists idx_customers_router_synced_at on customers(router_synced_at);

-- Dokumen pelanggan (KTP, foto rumah, kontrak, dll.)
create table if not exists customer_documents (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  file_name text not null,        -- nama asli file dari user
  file_url text,                  -- endpoint unduhan (/api/customers/:id/documents/:docId/file)
  file_type text,                 -- mime type
  file_size int,                  -- bytes
  remark text,                    -- keterangan (mirip PTA adddoc)
  uploaded_by int references users(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_customer_documents_customer on customer_documents(customer_id);

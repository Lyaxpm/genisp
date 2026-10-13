-- ============ STREAM S10: Portal publik + member ============
-- Tabel testimonials + penanda router CPE (milik pelanggan, bukan NAS bersama).
-- Idempoten: aman dijalankan ulang.

create table if not exists testimonials (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  message text not null,
  status text not null default 'pending', -- pending|approved|rejected
  created_at timestamptz not null default now()
);
create index if not exists idx_testimonials_status on testimonials(status, created_at desc);
create index if not exists idx_testimonials_customer on testimonials(customer_id);

-- Tandai router yang merupakan CPE milik satu pelanggan (boleh di-reboot dari portal).
-- Default false: router NAS bersama TIDAK boleh di-reboot member.
alter table routers add column if not exists is_cpe boolean not null default false;

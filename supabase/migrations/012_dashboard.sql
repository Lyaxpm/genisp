-- 012_dashboard.sql — Stream S11: KPI page-hit counter untuk dashboard.
-- Tabel dashboard_hits: satu baris per halaman, hits di-increment via POST /api/dashboard/kpi.

create table if not exists dashboard_hits (
  id serial primary key,
  page text not null unique,          -- mis. "dashboard", "customers", "invoices"
  hits bigint not null default 0,
  updated_at timestamptz not null default now()
);

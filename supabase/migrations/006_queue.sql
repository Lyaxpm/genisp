-- 006_queue.sql — Job queue persisten (cronjobs) + arsip backup DB.
-- Idempoten: aman dijalankan ulang. Stream S2 (job queue persisten + worker).

-- ============ CRONJOBS ============
create table if not exists cronjobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',       -- pending|running|done|failed
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_at timestamptz not null default now(),
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_cronjobs_status_run on cronjobs (status, run_at);
create index if not exists idx_cronjobs_type on cronjobs (job_type);

-- ============ BACKUPS (arsip hasil job db_backup) ============
create table if not exists backups (
  id serial primary key,
  name text not null,                            -- mis. backup-2026-10-13-0015.sql
  size_bytes bigint not null default 0,
  tables text[] not null default '{}',
  row_count int not null default 0,
  data text not null default '',                 -- isi SQL dump
  status text not null default 'done',           -- done|failed
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_backups_created on backups (created_at desc);

-- ============ Kolom status konektivitas (dipakai job router_olt_check) ============
alter table routers add column if not exists last_status text;        -- online|offline
alter table routers add column if not exists last_checked_at timestamptz;
alter table olts add column if not exists last_status text;           -- online|offline|untested
alter table olts add column if not exists last_checked_at timestamptz;

-- ============ Settings default job queue ============
insert into settings (key, value) values
  ('birthday_interval_minutes', '60'),
  ('wa_birthday', 'Selamat ulang tahun {nama}! Terima kasih telah setia bersama {perusahaan}. Semoga sehat dan sukses selalu.'),
  ('db_backup_retention', '14')
on conflict (key) do nothing;

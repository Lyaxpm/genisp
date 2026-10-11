-- Credentials are environment variables, never stored in exported settings.
create table if not exists genieacs_links (
  device_id text primary key,
  customer_id integer not null references customers(id) on delete cascade,
  updated_by integer references users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists genieacs_links_customer on genieacs_links(customer_id);
create table if not exists genieacs_actions (
  id bigserial primary key,
  device_id text not null,
  action text not null,
  status text not null,
  task_id text,
  created_by integer references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists genieacs_actions_device on genieacs_actions(device_id, id desc);
-- No passwords, parameter payloads, or authentication headers in audit rows.

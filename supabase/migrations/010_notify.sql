-- ============ S9 NOTIFIKASI: telegram links, fcm templates, notif queue ============

-- Tautan akun Telegram pelanggan ke chat bot.
create table if not exists telegram_links (
  id serial primary key,
  customer_id int not null references customers(id) on delete cascade,
  telegram_chat_id text not null unique,
  telegram_username text,
  created_at timestamptz not null default now()
);
create index if not exists idx_telegram_links_customer on telegram_links(customer_id);

-- Template push notification FCM (title + body).
create table if not exists fcm_templates (
  id serial primary key,
  name text not null unique,               -- mis. bill, paid, isolir, reminder
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into fcm_templates (name, title, body) values
  ('bill', 'Tagihan Baru', 'Halo {nama}, tagihan {kode} sebesar {nominal} telah terbit. Jatuh tempo {jatuh_tempo}.'),
  ('paid', 'Pembayaran Diterima', 'Terima kasih {nama}, pembayaran {kode} sebesar {nominal} telah kami terima.'),
  ('isolir', 'Layanan Diisolir', 'Halo {nama}, layanan internet Anda diisolir karena tagihan {kode} belum dibayar.'),
  ('reminder', 'Pengingat Tagihan', 'Halo {nama}, tagihan {kode} sebesar {nominal} jatuh tempo {jatuh_tempo}.')
on conflict (name) do nothing;

-- Antrean notifikasi terjadwal berprioritas (diproses cron /api/notify/queue/run).
create table if not exists notif_queue (
  id serial primary key,
  channel text not null check (channel in ('whatsapp', 'telegram', 'sms', 'email', 'fcm')),
  recipient text not null,                 -- no WA / chat_id telegram / no HP / email / token FCM
  message text not null,
  priority int not null default 0,         -- makin besar makin dulu diproses
  scheduled_at timestamptz,                -- null = langsung
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_notif_queue_due
  on notif_queue(status, priority desc, scheduled_at)
  where status = 'pending';

-- 011_livechat.sql — Livechat widget + pesan percakapan.
-- Idempoten: aman dijalankan ulang.

create table if not exists livechat_conversations (
  id              serial primary key,
  visitor_name    text not null default 'Pengunjung',
  visitor_contact text,
  -- Token rahasia milik pengunjung, dikembalikan saat percakapan dibuat.
  -- Semua akses pengunjung (lihat/kirim pesan) wajib menyertakan token ini.
  visitor_token   text not null,
  status          text not null default 'open' check (status in ('open', 'closed')),
  assigned_to     integer, -- user staff yang menangani (opsional)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz
);

create table if not exists livechat_messages (
  id              serial primary key,
  conversation_id integer not null references livechat_conversations(id) on delete cascade,
  sender          text not null check (sender in ('visitor', 'staff')),
  staff_name      text, -- nama staff yang membalas (bila sender = staff)
  message         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_livechat_conv_status
  on livechat_conversations (status, updated_at desc);
create index if not exists idx_livechat_msg_conv
  on livechat_messages (conversation_id, id);

-- Trigger: updated_at otomatis saat ada pesan baru / status berubah.
create or replace function livechat_touch_conversation() returns trigger as $$
begin
  update livechat_conversations
    set updated_at = now()
    where id = coalesce(new.conversation_id, old.conversation_id);
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_livechat_touch on livechat_messages;
create trigger trg_livechat_touch
  after insert on livechat_messages
  for each row execute function livechat_touch_conversation();

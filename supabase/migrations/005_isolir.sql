-- S1: Isolir EXPIRED (5 mode) — idempoten.
--   customers.isolir_mode        : override mode isolir per pelanggan
--                                  (disable | address-list | profile | filter-rule | binding;
--                                   NULL = ikut global settings.isolir_mode)
--   customers.isolir_prev_profile: profile user sebelum dipindah ke EXPIRED (mode profile),
--                                  dipakai saat buka isolir untuk mengembalikan profile semula.

alter table customers
  add column if not exists isolir_mode text;

alter table customers
  add column if not exists isolir_prev_profile text;

-- Mode isolir global (default: disable — sama seperti perilaku lama).
insert into settings (key, value)
  values ('isolir_mode', 'disable')
  on conflict (key) do nothing;

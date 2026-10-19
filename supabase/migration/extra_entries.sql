-- =============================================================
-- Contador manual de gente que entró sin prenotazione (botón
-- "Extra" en la pantalla de Scansiona QR) — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

alter table public.events
  add column if not exists extra_entries integer not null default 0;

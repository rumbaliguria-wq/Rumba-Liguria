-- =============================================================
-- Hora exacta del check-in de cada reserva — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

alter table public.reservations
  add column if not exists checked_in_at timestamptz;

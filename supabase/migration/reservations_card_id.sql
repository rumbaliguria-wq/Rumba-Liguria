-- =============================================================
-- Reservas de socios ligadas a su tessera — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

alter table public.reservations
  add column if not exists card_id uuid references public.client_cards(id) on delete set null;

create index if not exists reservations_card_event_idx on public.reservations (card_id, event_id);

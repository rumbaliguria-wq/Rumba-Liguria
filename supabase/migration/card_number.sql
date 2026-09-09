-- =============================================================
-- Numerazione delle tessere clienti — eseguire in:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

alter table public.client_cards
  add column if not exists card_number integer;

-- Asegura el número consecutivo a las tessere que ya existían, en
-- el orden en que se crearon (la más vieja = Nº 1) — así coincide
-- con el orden real en que se hicieron las tarjetas físicas.
with numbered as (
  select id, row_number() over (order by created_at asc) as rn
  from public.client_cards
  where card_number is null
)
update public.client_cards c
set card_number = numbered.rn
from numbered
where c.id = numbered.id;

create unique index if not exists client_cards_card_number_idx
  on public.client_cards(card_number);

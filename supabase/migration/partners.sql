-- =============================================================
-- Colaboradores externos (bares/locales que validan tus tessere
-- digitales para hacer descuentos) — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;

-- Para saber qué colaborador validó cada tessera (null = escaneo tuyo,
-- desde el panel de admin, como hasta ahora).
alter table public.card_scans add column if not exists partner_id uuid references public.partners(id) on delete set null;

create index if not exists card_scans_partner_id_idx on public.card_scans(partner_id);

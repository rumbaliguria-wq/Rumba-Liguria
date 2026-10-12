-- =============================================================
-- Accesos de personal de entrada (solo escanean tickets de UN
-- evento, sin ver el panel de admin) — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

create table if not exists public.door_passes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  event_id uuid not null references public.events(id) on delete cascade,
  pin text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists door_passes_event_id_idx on public.door_passes(event_id);

alter table public.door_passes enable row level security;

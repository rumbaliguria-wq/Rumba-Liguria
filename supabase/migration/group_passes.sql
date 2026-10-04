-- =============================================================
-- Codici Gruppo: un solo QR válido para muchas personas en una
-- noche (ej. 100-200), con tope opcional — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

create table if not exists public.group_passes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  event_id uuid not null references public.events(id) on delete cascade,
  label text,
  max_entries integer,
  created_at timestamptz not null default now()
);

create index if not exists group_passes_event_id_idx on public.group_passes(event_id);

alter table public.group_passes enable row level security;

-- Cada escaneo del código de grupo crea una fila de reserva "usada" propia
-- (así las estadísticas que ya existen lo cuentan solo, sin tocar nada más).
-- "set null" y no "cascade": si se borra el código de grupo, las entradas
-- que ya registró quedan igual para las estadísticas, solo sueltan el link.
alter table public.reservations add column if not exists group_pass_id uuid references public.group_passes(id) on delete set null;

create index if not exists reservations_group_pass_id_idx on public.reservations(group_pass_id);

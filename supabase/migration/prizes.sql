-- =============================================================
-- Premios por evento — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

create table if not exists public.prizes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null,
  description text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists prizes_event_email_idx on public.prizes (event_id, email);

-- =============================================================
-- Pagos con Stripe (carrito) — ejecutar en:
-- Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique,
  user_email text not null,
  -- Líneas del carrito: [{event_id, ticket_type, guest_count, referral, unit_cents}]
  items jsonb not null,
  amount_cents integer not null default 0,
  status text not null default 'pending', -- pending | paid | expired | refunded | partially_refunded
  -- Entradas generadas: [{event_id, event_title, codes: [...]}] y líneas rechazadas
  result jsonb,
  refunded_cents integer not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payments_user_email_idx on public.payments(user_email);
create index if not exists payments_status_idx on public.payments(status);

alter table public.payments enable row level security;

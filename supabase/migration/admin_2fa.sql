-- Verificación en dos pasos para el panel de administración.
-- Ejecutar una vez en el SQL Editor de Supabase para instalaciones existentes.

alter table public.admin_settings
  add column if not exists admin_email text,
  add column if not exists admin_phone text,
  add column if not exists whatsapp_apikey text,
  add column if not exists two_factor_enabled boolean not null default true;

-- Códigos de un solo uso enviados al hacer login (correo o WhatsApp).
create table if not exists public.admin_login_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null,
  channel text not null, -- 'email' | 'whatsapp'
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.admin_login_codes enable row level security;

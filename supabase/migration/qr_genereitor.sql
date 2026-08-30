-- =============================================================
-- Rumba Liguria Events — esquema completo de la base de datos
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- Reconstruido a partir del código de la aplicación.
-- =============================================================

-- Extensión para UUIDs (ya viene activa en Supabase, por si acaso)
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- Tabla: users (usuarios registrados en la web)
-- El campo phone guarda codificados nombre + teléfono + tipo de
-- usuario (ver src/lib/userPhone.ts)
-- -------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Tabla: events (eventos/fiestas)
-- El campo details guarda codificados sale_start/sale_end/
-- archive_at y tipos de entrada (ver src/lib/saleConfig.ts y
-- src/lib/ticketTypes.ts)
-- -------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  price text default 'free',
  flyer_url text,
  flyer_ratio text default '16:9',
  maps_url text,
  is_popular boolean not null default false,
  organizer text default 'Rumba Liguria',
  event_date text,
  event_date_iso text,
  event_time text,
  event_time_end text,
  max_tickets integer,
  max_per_person integer,
  dress_code text,
  min_age integer,
  publish_at timestamptz,
  archived boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Tabla: reservations (reservas / entradas con código QR)
-- Códigos especiales: user_email = '_vip_' para códigos VIP,
-- user_email = '_linknombre_' para links personalizados
-- -------------------------------------------------------------
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  event_id uuid not null references public.events(id) on delete cascade,
  user_email text not null,
  user_name text,
  guest_count integer not null default 1,
  status text not null default 'active', -- active | used | cancelled
  created_at timestamptz not null default now()
);

create index if not exists reservations_event_id_idx on public.reservations(event_id);
create index if not exists reservations_user_email_idx on public.reservations(user_email);
create index if not exists reservations_code_idx on public.reservations(code);

-- -------------------------------------------------------------
-- Tabla: admin_settings (credenciales del panel + configuración)
-- El campo accent_color también guarda codificada la config de
-- la sección de alquileres (ver src/lib/rentalConfig.ts)
-- Debe existir siempre la fila con id = 1
-- -------------------------------------------------------------
create table if not exists public.admin_settings (
  id integer primary key,
  username text,
  password text,
  accent_color text,
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id, username, password)
values (1, null, null)
on conflict (id) do nothing;

-- -------------------------------------------------------------
-- Tabla: gallery (galería de fotos/videos)
-- -------------------------------------------------------------
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  type text not null default 'image', -- image | video
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Tabla: comments (comentarios en eventos)
-- -------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_email text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_event_id_idx on public.comments(event_id);

-- -------------------------------------------------------------
-- Tabla: client_cards (tessere digitali personalizzate clienti)
-- Ogni cliente ha un codice QR unico salvato in "code".
-- -------------------------------------------------------------
create table if not exists public.client_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  country text,
  city text,
  birth_date date,
  phone text,
  email text,
  id_number text,
  id_type text, -- UNIVERSITARIO | ERASMUS | VIP | CLIENTE | OTRO:<testo libero>
  photo_url text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists client_cards_code_idx on public.client_cards(code);
create index if not exists client_cards_email_idx on public.client_cards(email);
create index if not exists client_cards_full_name_idx on public.client_cards(full_name);

-- -------------------------------------------------------------
-- Tabla: card_scans (storico accessi/ingressi registrati ad ogni
-- scansione del QR della tessera)
-- -------------------------------------------------------------
create table if not exists public.card_scans (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.client_cards(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  scanned_at timestamptz not null default now()
);

create index if not exists card_scans_card_id_idx on public.card_scans(card_id);
create index if not exists card_scans_scanned_at_idx on public.card_scans(scanned_at);

-- -------------------------------------------------------------
-- Seguridad: la app solo accede con la service role key desde
-- las rutas API del servidor, así que activamos RLS sin
-- políticas públicas (la service role key ignora RLS).
-- -------------------------------------------------------------
alter table public.users enable row level security;
alter table public.events enable row level security;
alter table public.reservations enable row level security;
alter table public.admin_settings enable row level security;
alter table public.gallery enable row level security;
alter table public.comments enable row level security;
alter table public.client_cards enable row level security;
alter table public.card_scans enable row level security;

-- -------------------------------------------------------------
-- Storage: bucket público "flyers" para flyers/galería/alquileres
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('flyers', 'flyers', true)
on conflict (id) do nothing;


-- Añade las columnas nuevas sin borrar nada de lo que ya existe
alter table public.client_cards add column if not exists id_type text;
alter table public.client_cards add column if not exists notes text;

-- Migra el tipo que ya tenías (card_type) al nuevo campo id_type
update public.client_cards
set id_type = card_type
where id_type is null and card_type is not null;

alter table public.card_scans add column if not exists event_id uuid references public.events(id) on delete set null;
alter table public.client_cards add column if not exists inactive_reason text;
alter table public.client_cards add column if not exists gender text;
alter table public.client_cards add column if not exists language text not null default 'it';
alter table public.client_cards add column if not exists card_color text not null default '#111111';
alter table public.reservations add column if not exists vip_number integer;
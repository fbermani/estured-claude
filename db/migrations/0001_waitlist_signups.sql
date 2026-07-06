-- EstuRed — Migración 0001: lista de espera pre-lanzamiento
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Tabla fuera del modelo de datos oficial (docs/06): captura interés
-- pre-lanzamiento desde /waitlist. Cuando el producto opere, la lista
-- de espera real es por residencia (docs/00 §9) y esta tabla podrá
-- archivarse o migrarse a leads de onboarding.

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('student', 'family', 'residence')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  city text check (char_length(city) <= 120),
  message text check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

-- Un registro por email (case-insensitive). Re-envíos no duplican.
create unique index if not exists waitlist_signups_email_unique
  on public.waitlist_signups (lower(email));

-- RLS activa sin policies: ni anon ni authenticated pueden leer o
-- escribir. Solo el service role (server actions de EstuRed) accede.
alter table public.waitlist_signups enable row level security;

comment on table public.waitlist_signups is
  'Lista de espera pre-lanzamiento (estudiantes, familias, residencias). Acceso solo via service role.';

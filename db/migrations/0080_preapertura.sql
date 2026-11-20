-- EstuRed — Migración 0080: preapertura (DR42–DR47, docs/23_PREAPERTURA.md)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    IDEMPOTENTE; necesita `public.users`, `public.residence_signup_requests` (0066) y `public.set_updated_at()`.
--    El código DEGRADA si todavía no está aplicada: los contadores muestran «Sé de los primeros» y el cupo cae a «Solo 10 lugares…».
--
-- QUÉ HACE
--   1. `residence_signup_requests.address` (DR46.4): la dirección reemplaza al barrio en el formulario de residencias.
--      Nullable en la migración porque las filas viejas no la tienen; el formulario nuevo la exige (validación de servidor).
--      `neighborhood` pasa a nullable (hoy NOT NULL) para que el formulario nuevo pueda dejar de pedirlo; las filas viejas lo conservan.
--   2. `preapertura_estudiantes` (DR43/DR44/DR45): una fila por cuenta creada en la preapertura (estudiante o familiar).
--      Guarda lo del paso 1 (rol, fecha de nacimiento, aceptación de Términos con la opción C) y lo del paso 2 (perfil opcional).
--      El año de ingreso se guarda aparte (la UI solo ofrece enero a abril y «todavía no sé»; se asume la próxima temporada).
--   3. `preapertura_invitaciones` (DR43.2, Fase 2): la ÚNICA invitación de un familiar a su hijo/a (unique por familiar, sin recordatorios).
--      Guarda solo el hash del token (el link se muestra una vez y se manda por mail si hay proveedor). Vence a los 30 días
--      (supuesto reversible: docs/23 §9 deja el vencimiento abierto). Al canjearla se vincula `family_links` (pendiente de aprobación).
--   `preapertura_interesados` NO se crea: DR42 la menciona pero no define qué datos guarda; se decide con el dueño en la Fase 2.
--
-- SEGURIDAD: RLS habilitada SIN policies y sin grants para anon/authenticated (como waitlist_signups y residence_signup_requests):
--   la tabla guarda PII (fecha de nacimiento, universidad, residencia actual). Solo el service role (server actions) accede.
--   No agregar policies «para que funcione»: abriría datos personales al público.
--
-- SUPUESTOS REVERSIBLES
--   - `role`: 'student' | 'family'. El contador público cuenta solo 'student'.
--   - Hábitos e intereses: hasta 2 cada uno (DR43.3). Los valores concretos (chips predefinidos) los valida la aplicación.
--   - `consent_c`: queda en true cuando el casillero obligatorio del paso 1 (Términos + opción C) se aceptó; se guarda por trazabilidad.
--   - `consent_comunidad`: casillero del carrusel público, SIN tildar por defecto (DR44.2); solo lo puede tildar un estudiante 18+.
--   - `current_residence`: nunca se muestra a esa residencia ni en el carrusel (DR44.1/DR45.1).
--
-- REVERTIR:
--   drop table if exists public.preapertura_invitaciones;
--   drop table if exists public.preapertura_estudiantes;
--   alter table public.residence_signup_requests drop column if exists address;
--   -- (neighborhood NOT NULL solo se puede restaurar si ninguna fila lo tiene en null:
--   --  update public.residence_signup_requests set neighborhood = 'Sin dato' where neighborhood is null;
--   --  alter table public.residence_signup_requests alter column neighborhood set not null;)

begin;

-- 1. Dirección en las solicitudes de alta de residencias.
alter table public.residence_signup_requests
  add column if not exists address text;

alter table public.residence_signup_requests
  drop constraint if exists residence_signup_requests_address_check;
alter table public.residence_signup_requests
  add constraint residence_signup_requests_address_check
  check (address is null or char_length(btrim(address)) between 5 and 200);

alter table public.residence_signup_requests
  alter column neighborhood drop not null;

-- 2. Estudiantes y familiares preinscriptos.
create table if not exists public.preapertura_estudiantes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  role text not null check (role in ('student', 'family')),
  birth_date date,
  terms_accepted_at timestamptz not null default now(),
  consent_c boolean not null default false,
  consent_comunidad boolean not null default false,
  invited_by_user_id uuid references public.users (id) on delete set null,
  -- Paso 2 (todo opcional, «Lo completo después»).
  first_name text check (first_name is null or char_length(btrim(first_name)) between 1 and 60),
  country text check (country is null or char_length(btrim(country)) between 2 and 60),
  province text check (province is null or char_length(btrim(province)) between 2 and 60),
  university text check (university is null or char_length(btrim(university)) between 2 and 120),
  career text check (career is null or char_length(btrim(career)) between 2 and 120),
  entry_month smallint check (entry_month is null or entry_month between 1 and 12),
  entry_year smallint check (entry_year is null or entry_year between 2026 and 2100),
  -- «Todavía no sé»: sin mes ni año, pero distinto de «no contestó» (la tarjeta de búsqueda dice «Fecha flexible»).
  entry_unsure boolean not null default false,
  room_type text check (room_type is null or room_type in ('individual', 'shared', 'any')),
  habits text[] not null default '{}' check (cardinality(habits) <= 2),
  interests text[] not null default '{}' check (cardinality(interests) <= 2),
  current_residence text check (current_residence is null or char_length(btrim(current_residence)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists preapertura_estudiantes_role_created_idx
  on public.preapertura_estudiantes (role, created_at);
create index if not exists preapertura_estudiantes_community_idx
  on public.preapertura_estudiantes (created_at) where consent_comunidad;

drop trigger if exists preapertura_estudiantes_updated_at on public.preapertura_estudiantes;
create trigger preapertura_estudiantes_updated_at before update on public.preapertura_estudiantes
  for each row execute function public.set_updated_at();

alter table public.preapertura_estudiantes enable row level security;
revoke all on public.preapertura_estudiantes from anon, authenticated;

-- 3. Invitación familiar (una por familiar).
create table if not exists public.preapertura_invitaciones (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null unique references public.users (id) on delete cascade,
  invitee_email text not null check (char_length(invitee_email) between 5 and 254),
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '30 days'),
  redeemed_at timestamptz,
  redeemed_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.preapertura_invitaciones enable row level security;
revoke all on public.preapertura_invitaciones from anon, authenticated;

commit;

-- VERIFICACIÓN (correr aparte; esperado: rls = true, 0 policies, anon_select = false, address presente)
-- select relrowsecurity as rls, (select count(*) from pg_policies where tablename = 'preapertura_estudiantes') as policies
--   from pg_class where oid = 'public.preapertura_estudiantes'::regclass;
-- select has_table_privilege('anon', 'public.preapertura_estudiantes', 'select') as anon_select;  -- esperado: false
-- select relrowsecurity as rls_inv, (select count(*) from pg_policies where tablename = 'preapertura_invitaciones') as policies_inv
--   from pg_class where oid = 'public.preapertura_invitaciones'::regclass;  -- esperado: true, 0
-- select column_name, is_nullable from information_schema.columns
--  where table_name = 'residence_signup_requests' and column_name in ('address', 'neighborhood');
-- select column_name, data_type from information_schema.columns where table_name = 'preapertura_estudiantes' order by ordinal_position;

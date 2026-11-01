-- EstuRed — Migración 0066: solicitudes de alta de residencias (DR22 D/E1–E7)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    IDEMPOTENTE; necesita `public.users`, `public.residences` y `public.set_updated_at()` (migraciones previas).
--
-- QUÉ HACE
--   Crea `residence_signup_requests`: la residencia NO crea cuenta sola; deja sus datos principales (E1) y el equipo de EstuRed
--   la contacta, coordina visita y recién ahí entrega la cuenta por enlace personal de un solo uso con vencimiento (E3).
--   Estados propios de la solicitud (E2), separados de los de residencia (docs/04) y del ciclo DR7:
--     received -> in_contact -> visit_scheduled -> account_delivered, más discarded.
--   Entrega de cuenta: se guarda SOLO el SHA-256 del token (`invite_token_hash`, 64 hex), nunca el token (patrón DR19 / 0064).
--   `residence_id` se completa cuando la cuenta queda vinculada a su ficha.
--
-- SEGURIDAD: RLS habilitada SIN policies y sin grants para anon/authenticated (como waitlist_signups): solo service role.
--
-- SUPUESTOS REVERSIBLES
--   - `handled_by` referencia public.users (id); sin asignación por persona en el MVP (E6), queda como "último admin que tocó".
--   - Duplicados: un único parcial sobre (lower(btrim(email)), lower(btrim(residence_name))) para solicitudes activas
--     (status distinto de account_delivered y discarded). Una descartada o ya entregada no bloquea una nueva.
--   - `email_confirmed_at`: el email del formulario no está verificado y el canje crea la cuenta con email confirmado; por eso el admin
--     debe confirmarlo con la residencia antes de generar la invitación. Se resetea si el admin edita el email.
--   - Largos máximos de campos de texto (anti-abuso del formulario público); ajustables.
--
-- REVERTIR:
--   drop table if exists public.residence_signup_requests;

begin;

create table if not exists public.residence_signup_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  residence_name text not null check (char_length(btrim(residence_name)) between 2 and 120),
  neighborhood text not null check (char_length(btrim(neighborhood)) between 2 and 80),
  contact_name text not null check (char_length(btrim(contact_name)) between 2 and 120),
  email text not null check (char_length(btrim(email)) between 3 and 254),
  phone text not null check (char_length(btrim(phone)) between 5 and 40),
  instagram_or_web text check (instagram_or_web is null or char_length(instagram_or_web) <= 200),
  approx_beds integer check (approx_beds is null or approx_beds > 0),
  status text not null default 'received'
    check (status in ('received', 'in_contact', 'visit_scheduled', 'account_delivered', 'discarded')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),
  contacted_at timestamptz,
  visit_at timestamptz,
  handled_by uuid references public.users (id) on delete set null,
  source text not null default 'web' check (char_length(source) <= 40),
  email_confirmed_at timestamptz,  -- el admin confirmó el email con la residencia (contacto real); sin esto no se genera la invitación
  invite_token_hash text unique check (invite_token_hash is null or char_length(invite_token_hash) = 64),
  invite_expires_at timestamptz,
  invite_used_at timestamptz,
  residence_id uuid references public.residences (id) on delete set null
);

create index if not exists residence_signup_requests_status_idx on public.residence_signup_requests (status);
create index if not exists residence_signup_requests_created_idx on public.residence_signup_requests (created_at);
create index if not exists residence_signup_requests_residence_idx on public.residence_signup_requests (residence_id) where residence_id is not null;

-- Evita duplicados ACTIVOS por email + nombre de residencia normalizados.
create unique index if not exists residence_signup_requests_active_dedup
  on public.residence_signup_requests (lower(btrim(email)), lower(btrim(residence_name)))
  where status not in ('account_delivered', 'discarded');

drop trigger if exists residence_signup_requests_updated_at on public.residence_signup_requests;
create trigger residence_signup_requests_updated_at before update on public.residence_signup_requests
  for each row execute function public.set_updated_at();

alter table public.residence_signup_requests enable row level security;
revoke all on public.residence_signup_requests from anon, authenticated;

commit;

-- VERIFICACIÓN (correr aparte; esperado: rls = true, 0 policies, columnas y checks listados)
-- select relrowsecurity as rls, (select count(*) from pg_policies where tablename = 'residence_signup_requests') as policies
--   from pg_class where oid = 'public.residence_signup_requests'::regclass;
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_name = 'residence_signup_requests' order by ordinal_position;
-- select indexname from pg_indexes where tablename = 'residence_signup_requests';
-- select has_table_privilege('anon', 'public.residence_signup_requests', 'select') as anon_select;  -- esperado: false

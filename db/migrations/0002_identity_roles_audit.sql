-- EstuRed — Migración 0002: identidad, roles, consentimientos y auditoría
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §4.1, §5.1–5.3, §6.1–6.2, §22.1
-- y docs/12_BUILD_PLAN.md Fase 1.

-- ==== Enum de roles (docs/06 §4.1) ====
create type public.user_role as enum (
  'guest', 'registered_user', 'student', 'family_member',
  'residence_owner', 'residence_staff', 'admin', 'superadmin', 'system'
);

-- ==== Helper: updated_at automático ====
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ==== users (docs/06 §5.1) — identidad de aplicación sobre auth.users ====
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  phone text,
  primary_role public.user_role not null default 'registered_user',
  is_active boolean not null default true,
  is_blocked boolean not null default false,
  blocked_reason text,
  last_login_at timestamptz,
  preferred_notification_channel text not null default 'email'
    check (preferred_notification_channel in ('email', 'in_app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ==== user_roles (docs/06 §5.2) — múltiples roles por usuario ====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  role public.user_role not null,
  scope_type text check (scope_type in ('global', 'residence', 'student')),
  scope_id uuid,
  is_active boolean not null default true,
  granted_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  unique nulls not distinct (user_id, role, scope_type, scope_id)
);
create index user_roles_user_id_idx on public.user_roles (user_id);

-- ==== consents (docs/06 §5.3) — aceptaciones versionadas ====
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  consent_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
);
create index consents_user_id_idx on public.consents (user_id);

-- ==== student_profiles (docs/06 §6.1) ====
create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,            -- privado, nunca público
  last_initial text not null,
  birth_date date not null,           -- privada
  display_age integer,
  nationality text not null,
  country_flag text,
  origin_city text,
  origin_country text,
  career text,
  study_institution_private text not null,  -- privado
  academic_objective text,            -- obligatorio recién para comprobante
  bio text,
  habits jsonb not null default '{}'::jsonb,
  interests jsonb not null default '{}'::jsonb,
  photo_file_id uuid,
  avatar_type text not null default 'initials'
    check (avatar_type in ('photo', 'flag', 'initials')),
  is_minor boolean not null default false,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger student_profiles_updated_at before update on public.student_profiles
  for each row execute function public.set_updated_at();

-- ==== student_visibility_settings (docs/06 §6.2) — defaults privados ====
create table public.student_visibility_settings (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null unique
    references public.student_profiles (id) on delete cascade,
  show_photo_to_guests boolean not null default false,
  show_photo_to_registered boolean not null default false,
  show_age_to_registered boolean not null default false,
  show_nationality_to_registered boolean not null default false,
  show_career_to_registered boolean not null default false,
  show_origin_city_to_registered boolean not null default false,
  show_habits_to_registered boolean not null default false,
  show_interests_to_registered boolean not null default false,
  is_individual_profile_visible boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger student_visibility_updated_at before update on public.student_visibility_settings
  for each row execute function public.set_updated_at();

-- ==== audit_logs (docs/06 §22.1) — nunca se edita ni se borra ====
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason_code text,
  reason_text text,
  ip_address inet,
  user_agent text,
  is_system_action boolean not null default false,
  source text not null default 'user'
    check (source in ('user', 'admin', 'system', 'payment_provider')),
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id);

-- ==== Row Level Security ====
-- Patrón: el service role (server actions de EstuRed) hace todas las
-- escrituras. Los usuarios autenticados solo leen/actualizan lo propio.

alter table public.users enable row level security;
create policy users_select_own on public.users
  for select to authenticated using (id = (select auth.uid()));
create policy users_update_own on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and is_blocked = false);

alter table public.user_roles enable row level security;
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.consents enable row level security;
create policy consents_select_own on public.consents
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.student_profiles enable row level security;
create policy student_profiles_select_own on public.student_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy student_profiles_update_own on public.student_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.student_visibility_settings enable row level security;
create policy visibility_select_own on public.student_visibility_settings
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );
create policy visibility_update_own on public.student_visibility_settings
  for update to authenticated
  using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );

-- audit_logs: RLS sin policies — solo service role lee y escribe.
alter table public.audit_logs enable row level security;

comment on table public.users is 'Identidad de aplicación sobre auth.users. Escrituras solo vía service role.';
comment on table public.audit_logs is 'Auditoría de acciones críticas (docs/06 §22.1). Append-only, solo service role.';

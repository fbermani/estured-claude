-- EstuRed — Migración 0019: residentes + comunidad visible, alcance
-- acotado a Modo Perfil Verificado (Fase 5.3 acotada)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §15.1 (resident_stays), docs/05
-- §15 (permisos de comunidad visible), docs/12 §9.5.
--
-- Decisión de alcance (dueño, Ciclo 33bis): docs/12 §9.3 lista
-- "comunidad visible" como función exclusiva de Gestión Operativa
-- (flag has_operational_management_access, activación en Fase 9bis,
-- todavía sin construir), pero docs/12 §9.5 y docs/05 §15 la describen
-- sin condicionarla al flag. Se construye la variante que sí tiene
-- valor real hoy: agrupada por `room_type_id` (Perfil Verificado), sin
-- `room_id`/`place_id` reales — esas dos columnas del modelo original
-- (docs/06 §15.1) se agregan recién cuando exista `rooms`/`places`
-- (Fase 9bis), mismo patrón que `external_residence_payments.renewal_offer_id`
-- se agregó en la migración 0017 cuando hizo falta, no antes.

create type public.resident_stay_status as enum (
  'created_by_residence', 'pending_activation', 'active',
  'visibility_limited', 'hidden_by_user', 'inactive'
);

create table public.resident_stays (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid references public.student_profiles (id),
  residence_id uuid not null references public.residences (id),
  room_type_id uuid references public.room_types (id),
  reservation_id uuid references public.reservations (id),
  created_by_residence_user_id uuid references public.users (id),
  invite_email text,
  status public.resident_stay_status not null default 'pending_activation',
  start_date date,
  end_date date,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger resident_stays_updated_at before update on public.resident_stays
  for each row execute function public.set_updated_at();

create index resident_stays_residence_idx on public.resident_stays (residence_id, is_current, status);
create index resident_stays_student_idx on public.resident_stays (student_profile_id);
create index resident_stays_reservation_idx on public.resident_stays (reservation_id);

-- Un estudiante no puede tener 2 estadías "actuales" a la vez en la
-- misma residencia (docs/06 §15.1 no lo dice explícito, pero `is_current`
-- solo tiene sentido como singleton por par estudiante+residencia).
create unique index resident_stays_current_unique
  on public.resident_stays (student_profile_id, residence_id)
  where is_current = true and student_profile_id is not null;

-- ==== Row Level Security (mismo patrón que waitlist_entries, migración 0018) ====
alter table public.resident_stays enable row level security;
create policy resident_stays_select_student on public.resident_stays
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );
create policy resident_stays_select_family on public.resident_stays
  for select to authenticated using (public.is_family_member_of_student(student_profile_id));
create policy resident_stays_select_residence on public.resident_stays
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

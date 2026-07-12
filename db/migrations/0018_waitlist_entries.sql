-- EstuRed — Migración 0018: lista de espera por residencia (Fase 5.1)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/12_BUILD_PLAN.md §9.4 (Fase 5), docs/06_DATA_MODEL.md §4.12
-- (waitlist_status) y §10.2 (waitlist_entries), docs/08 §6.10/§7.11.
--
-- Distinta de `waitlist_signups` (migración 0001): esa es la lista de
-- espera PÚBLICA pre-lanzamiento (interés general, sin login, docs/06
-- la marca "fuera del modelo de datos oficial"). Esta es la lista de
-- espera POR RESIDENCIA documentada como feature real del producto —
-- un estudiante logueado se suma a la espera de una residencia
-- específica cuando no hay disponibilidad.

create type public.waitlist_status as enum (
  'active', 'availability_notification_sent', 'retention_check_sent',
  'student_activated_request', 'removed_by_student',
  'removed_due_to_confirmed_reservation', 'removed_by_residence',
  'removed_by_admin', 'closed_by_residence'
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id),
  residence_id uuid not null references public.residences (id),
  room_type_id uuid references public.room_types (id),
  desired_start_date date,
  desired_duration_months integer,
  status public.waitlist_status not null default 'active',
  joined_at timestamptz not null default now(),
  last_keep_alive_notified_at timestamptz,
  removed_at timestamptz,
  removed_by uuid references public.users (id),
  removed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger waitlist_entries_updated_at before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

-- docs/06 §24.5: índices + único parcial (un activo por estudiante+
-- residencia+tipo de habitación — NULL en room_type_id se trata como
-- "cualquier tipo", así que se normaliza con coalesce a un uuid fijo
-- para que el índice parcial también cubra ese caso).
create index waitlist_entries_student_idx on public.waitlist_entries (student_profile_id, status);
create index waitlist_entries_residence_idx on public.waitlist_entries (residence_id, room_type_id, status);
create unique index waitlist_entries_active_unique
  on public.waitlist_entries (student_profile_id, residence_id, coalesce(room_type_id, '00000000-0000-0000-0000-000000000000'))
  where status = 'active';

-- ==== Row Level Security (mismo patrón que renewal_requests, migración 0016) ====
alter table public.waitlist_entries enable row level security;
create policy waitlist_entries_select_student on public.waitlist_entries
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );
create policy waitlist_entries_select_family on public.waitlist_entries
  for select to authenticated using (public.is_family_member_of_student(student_profile_id));
create policy waitlist_entries_select_residence on public.waitlist_entries
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

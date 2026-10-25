-- EstuRed — Migración 0055: seguimiento post-ingreso a los 5 días (DR14, fase 3)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Es ADITIVA e IDEMPOTENTE (enum y tablas con guardas, drop/create de policies y funciones) y no modifica filas existentes.
--    Necesita: `resident_stays` (0019), `residences`, `users`, `student_profiles` (0002/0003) y `is_family_member_of_student` (0006/0046).
--    Hasta que se aplique, el código degrada con gracia: el job no hace nada, `/students/followup/[id]` y `/admin/followups` avisan
--    que el seguimiento todavía no está disponible.
--
-- MOTIVO. docs/00 §31 DR14, docs/04 §12ter, docs/05 §16bis, docs/06 §15.3 y §27.12: a los 5 días del ingreso la residencia recibe un
-- recordatorio (consulta por su cuenta) y EstuRed le hace una encuesta corta al estudiante (y al guardián si es menor). La residencia NO ve
-- ni la respuesta ni el estado del seguimiento; solo admin/superadmin (service role) leen las respuestas.
--
-- QUÉ HACE
--   1. Enum `stay_followup_status` (scheduled, sent, answered, no_response, reviewed, cancelled).
--   2. `stay_followups` (una por estadía, unique) y `stay_followup_responses` (una por respondente, unique (followup, rol)).
--      Supuesto reversible: `stay_followups.sent_at` (cuándo pasó a `sent`) para contar los 14 días de `no_response` también cuando no hay
--      encuesta (estadía sin cuenta de estudiante); no está en docs/06 §15.3.
--   3. RLS estricta. La residencia (dueño/staff), el familiar de OTRO estudiante y anon no tienen NINGUNA policy sobre estas tablas.
--      - `stay_followups`: el estudiante dueño y su familiar vinculado ACTIVO (solo si es menor) pueden leer la fila, y solo las columnas
--        no internas (nunca `admin_note`, `reviewed_*`, `communicated_to_residence`, `residence_reminder_sent_at`): GRANT por columna.
--      - `stay_followup_responses`: cada uno lee e inserta SOLO la suya (`respondent_user_id = auth.uid()`); el guardián no ve la del
--        estudiante ni al revés (DR3b). Sin UPDATE ni DELETE para `authenticated`.
--      Las funciones que cruzan tablas son SECURITY DEFINER (evita recursión de RLS).
--   4. Admin/superadmin: service role (sin policy), como el resto del panel.
--
-- REVERTIR (borra el seguimiento y las respuestas; el código vuelve a degradar con gracia):
--   drop table if exists public.stay_followup_responses;
--   drop table if exists public.stay_followups;
--   drop function if exists public.can_read_stay_followup(uuid);
--   drop function if exists public.can_answer_stay_followup(uuid, text);
--   drop type if exists public.stay_followup_status;

begin;

-- ==== 0. Guarda ====
do $$
begin
  if to_regclass('public.resident_stays') is null
     or to_regclass('public.residences') is null
     or to_regclass('public.users') is null
     or to_regclass('public.student_profiles') is null then
    raise exception '0055: faltan resident_stays / residences / users / student_profiles (migraciones 0002, 0003 y 0019)';
  end if;
  if to_regprocedure('public.is_family_member_of_student(uuid)') is null then
    raise exception '0055: falta la función is_family_member_of_student (migraciones 0006/0046)';
  end if;
end
$$;

-- ==== 1. Enum ====
do $$
begin
  if not exists (select 1 from pg_type where typname = 'stay_followup_status' and typnamespace = 'public'::regnamespace) then
    create type public.stay_followup_status as enum ('scheduled', 'sent', 'answered', 'no_response', 'reviewed', 'cancelled');
  end if;
end
$$;

-- ==== 2. Tablas ====
create table if not exists public.stay_followups (
  id uuid primary key default gen_random_uuid(),
  resident_stay_id uuid not null unique references public.resident_stays (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  status public.stay_followup_status not null default 'scheduled',
  due_at timestamptz not null,
  sent_at timestamptz,
  residence_reminder_sent_at timestamptz,
  survey_sent_at timestamptz,
  reviewed_by_user_id uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  communicated_to_residence boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists stay_followups_status_due_idx on public.stay_followups (status, due_at);
create index if not exists stay_followups_student_idx on public.stay_followups (student_profile_id);
create index if not exists stay_followups_residence_idx on public.stay_followups (residence_id);

drop trigger if exists stay_followups_updated_at on public.stay_followups;
create trigger stay_followups_updated_at before update on public.stay_followups
  for each row execute function public.set_updated_at();

create table if not exists public.stay_followup_responses (
  id uuid primary key default gen_random_uuid(),
  stay_followup_id uuid not null references public.stay_followups (id) on delete cascade,
  respondent_user_id uuid not null references public.users (id) on delete cascade,
  respondent_role text not null check (respondent_role in ('student', 'guardian')),
  how_is_it_going text not null check (how_is_it_going in ('very_well', 'well', 'so_so', 'not_well')),
  was_as_expected text not null check (was_as_expected in ('yes', 'partly', 'no')),
  comment text check (comment is null or char_length(comment) <= 1000),
  answered_at timestamptz not null default now(),
  constraint stay_followup_responses_role_unique unique (stay_followup_id, respondent_role)
);
create index if not exists stay_followup_responses_user_idx on public.stay_followup_responses (respondent_user_id);

-- ==== 3. Funciones SECURITY DEFINER ====
-- ¿El usuario autenticado puede leer este seguimiento? El estudiante dueño, o su familiar vinculado activo SOLO si el estudiante es menor.
create or replace function public.can_read_stay_followup(p_followup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stay_followups f
    join public.student_profiles sp on sp.id = f.student_profile_id
    where f.id = p_followup_id
      and (
        sp.user_id = auth.uid()
        or (sp.is_minor = true and public.is_family_member_of_student(sp.id))
      )
  );
$$;

-- ¿Puede responder con ese rol? Solo mientras está `sent` o `answered` (en un menor, cada uno responde por separado); 'student' = el estudiante dueño; 'guardian' = familiar vinculado activo de un menor.
create or replace function public.can_answer_stay_followup(p_followup_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.stay_followups f
    join public.student_profiles sp on sp.id = f.student_profile_id
    where f.id = p_followup_id
      and f.status in ('sent', 'answered')
      and (
        (p_role = 'student' and sp.user_id = auth.uid())
        or (p_role = 'guardian' and sp.is_minor = true and public.is_family_member_of_student(sp.id))
      )
  );
$$;

revoke all on function public.can_read_stay_followup(uuid) from public, anon;
revoke all on function public.can_answer_stay_followup(uuid, text) from public, anon;
grant execute on function public.can_read_stay_followup(uuid) to authenticated;
grant execute on function public.can_answer_stay_followup(uuid, text) to authenticated;

-- ==== 4. RLS ====
alter table public.stay_followups enable row level security;
alter table public.stay_followup_responses enable row level security;

drop policy if exists stay_followups_select_own on public.stay_followups;
create policy stay_followups_select_own on public.stay_followups
  for select to authenticated using (public.can_read_stay_followup(id));

drop policy if exists stay_followup_responses_select_own on public.stay_followup_responses;
create policy stay_followup_responses_select_own on public.stay_followup_responses
  for select to authenticated using (respondent_user_id = (select auth.uid()));

drop policy if exists stay_followup_responses_insert_own on public.stay_followup_responses;
create policy stay_followup_responses_insert_own on public.stay_followup_responses
  for insert to authenticated with check (
    respondent_user_id = (select auth.uid())
    and public.can_answer_stay_followup(stay_followup_id, respondent_role)
  );

-- ==== 5. Grants: anon nada; authenticated solo columnas no internas / insert propio ====
revoke all on public.stay_followups from anon, authenticated;
revoke all on public.stay_followup_responses from anon, authenticated;
grant select (id, resident_stay_id, residence_id, student_profile_id, status, due_at, survey_sent_at, created_at)
  on public.stay_followups to authenticated;
grant select on public.stay_followup_responses to authenticated;
grant insert (stay_followup_id, respondent_user_id, respondent_role, how_is_it_going, was_as_expected, comment)
  on public.stay_followup_responses to authenticated;
grant all on public.stay_followups to service_role;
grant all on public.stay_followup_responses to service_role;

commit;

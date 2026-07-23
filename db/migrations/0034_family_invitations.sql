-- EstuRed — Migración 0034: invitación de familiar por email
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Ciclo 37: el estudiante invita a un padre/tutor por email desde "Mi
-- perfil", antes de que esa persona tenga cuenta. Se modela aparte de
-- `family_links` (migración 0004) a propósito — esa tabla ya tiene un
-- enum e índice único ("1 activo por estudiante") afinados para el
-- flujo real de aprobación (app/students/family-link-actions.ts) y no
-- hace falta tocarlos: la invitación no crea un vínculo por sí sola,
-- solo dispara el email — el familiar igual tiene que registrarse en
-- /register/family y el estudiante tiene que aprobar el vínculo como
-- ya funciona hoy.

create type public.family_invitation_status as enum ('pending', 'cancelled');

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 200),
  status public.family_invitation_status not null default 'pending',
  invited_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index family_invitations_student_idx on public.family_invitations (student_profile_id);

alter table public.family_invitations enable row level security;
create policy family_invitations_select_own on public.family_invitations
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );

comment on table public.family_invitations is 'Invitación por email a un padre/tutor todavía sin cuenta — no crea family_links hasta que se registre y el estudiante apruebe el vínculo. Escrituras vía service role.';

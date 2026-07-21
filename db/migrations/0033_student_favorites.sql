-- EstuRed — Migración 0033: Favoritos (Ciclo 35, cont.)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/02_MVP_SCOPE.md §8.1, docs/08_UI_SCREENS_AND_FLOWS.md §6.2
-- (ruta /students/favorites, el familiar puede sugerir, la UI distingue
-- favorito propio vs sugerido). Sin workflow de aprobación (a diferencia
-- de family_application_proposals) — es una lista compartida aditiva,
-- cada fila ya lleva quién la agregó.

create table public.student_favorites (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  added_by_role text not null check (added_by_role in ('student', 'family_member')),
  added_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  unique (student_profile_id, residence_id)
);
create index student_favorites_student_idx on public.student_favorites (student_profile_id);
create index student_favorites_residence_idx on public.student_favorites (residence_id);

-- ==== Row Level Security ====
-- Mismo patrón que el resto del proyecto: escrituras solo vía service
-- role (server actions); lectura filtrada por RLS. Reusa
-- `is_family_member_of_student` (migración 0006) para el acceso del
-- familiar vinculado, sin duplicar el join ni arriesgar la recursión
-- que esa función ya resolvió.

alter table public.student_favorites enable row level security;

create policy student_favorites_select_student on public.student_favorites
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );

create policy student_favorites_select_family on public.student_favorites
  for select to authenticated using (public.is_family_member_of_student(student_profile_id));

comment on table public.student_favorites is
  'Favoritos (docs/02 §8.1, docs/08 §6.2). Estudiante guarda residencias para comparar; familiar vinculado puede sugerir. Lista aditiva compartida, sin aprobación. Escrituras solo vía service role (server actions).';

-- EstuRed — Migración 0006: fix de recursión infinita en RLS (0005)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Error real detectado en e2e: "infinite recursion detected in policy
-- for relation student_profiles". Causa: la policy de student_profiles
-- (0005) consulta family_links, y la policy de family_links (0004) a su
-- vez consulta student_profiles — ciclo. Mismo problema en family_members.
--
-- Fix: funciones SECURITY DEFINER que resuelven el lookup con los
-- privilegios del dueño de la función (bypassean RLS de family_links
-- puertas adentro), rompiendo el ciclo de evaluación de policies.
-- Patrón estándar de Supabase para RLS entre tablas mutuamente relacionadas.

drop policy if exists student_profiles_select_linked_family on public.student_profiles;
drop policy if exists family_members_select_linked_student on public.family_members;

create or replace function public.is_family_member_of_student(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_links
    where student_profile_id = profile_id
      and family_member_id in (
        select id from public.family_members where user_id = auth.uid()
      )
  );
$$;

create or replace function public.is_student_linked_to_family_member(fm_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_links
    where family_member_id = fm_id
      and student_profile_id in (
        select id from public.student_profiles where user_id = auth.uid()
      )
  );
$$;

create policy student_profiles_select_linked_family on public.student_profiles
  for select to authenticated using (public.is_family_member_of_student(id));

create policy family_members_select_linked_student on public.family_members
  for select to authenticated using (public.is_student_linked_to_family_member(id));

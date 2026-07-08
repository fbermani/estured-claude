-- EstuRed — Migración 0005: fix de RLS para datos embebidos de family_links
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Bug encontrado en e2e: al leer family_links con embed
-- (`family_members(...)` o `student_profiles(...)`), PostgREST aplica
-- el RLS de la tabla embebida también — y las policies de 0002/0004
-- solo dejaban ver "lo propio", así que el nombre del otro lado del
-- vínculo siempre venía null. Faltaba la policy inversa en cada tabla.

create policy family_members_select_linked_student on public.family_members
  for select to authenticated using (
    id in (
      select family_member_id from public.family_links
      where student_profile_id in (
        select id from public.student_profiles where user_id = (select auth.uid())
      )
    )
  );

create policy student_profiles_select_linked_family on public.student_profiles
  for select to authenticated using (
    id in (
      select student_profile_id from public.family_links
      where family_member_id in (
        select id from public.family_members where user_id = (select auth.uid())
      )
    )
  );

-- 0098 · Endurecimiento de funciones (pre-producción, auditoría 2026-11-19)
-- 1) Dos helpers SECURITY DEFINER quedaron sin uso (se borraron sus policies en 0081 B9): ya no los puede llamar nadie con sesión.
-- 2) enforce_application_active_cap (0093, trigger): search_path fijo y sin EXECUTE para anon/authenticated (un trigger no lo necesita).
-- 3) Toda función nueva en `public` deja de ser ejecutable por anon/PUBLIC por defecto (hay que otorgarlo a mano donde haga falta).
-- Idempotente. No cambia datos ni policies.

revoke execute on function public.is_reservation_student(uuid) from public, anon, authenticated;
revoke execute on function public.can_answer_stay_followup(uuid, text) from public, anon, authenticated;

alter function public.enforce_application_active_cap() set search_path = '';
revoke execute on function public.enforce_application_active_cap() from public, anon, authenticated;

alter default privileges in schema public revoke execute on functions from public, anon;

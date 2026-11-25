-- 0107 · Endurecimiento de privilegios de lectura (auditoría 2026-11-22, plan B)
-- 1) profile_availability.last_confirmed_by: id interno de usuario; nadie lo lee con sesión (solo service role escribe).
-- 2) 14 tablas con RLS y sin policies: `authenticated` conservaba SELECT sin poder leer filas. Se revoca.
--    Todas se leen solo con service role (verificado con grep: ninguna consulta con cliente de usuario).
-- No se toca residences.created_by: la tabla tiene grant SELECT a nivel de tabla; revocar una columna obliga
--    a regrantar las 43 restantes y cada columna nueva quedaría ilegible en silencio. Es un uuid sin PII.
-- No se mueve pg_net (rompería el cron 0013).
-- Idempotente. No cambia datos ni policies.

revoke select (last_confirmed_by) on public.profile_availability from anon, authenticated;

revoke select on public.application_status_events from authenticated;
revoke select on public.arrival_reminder_sends from authenticated;
revoke select on public.audit_logs from authenticated;
revoke select on public.beds from authenticated;
revoke select on public.document_access_log from authenticated;
revoke select on public.family_email_verifications from authenticated;
revoke select on public.files from authenticated;
revoke select on public.payment_settings from authenticated;
revoke select on public.residence_faq_questions from authenticated;
revoke select on public.residence_profile_edits from authenticated;
revoke select on public.resident_notes from authenticated;
revoke select on public.rooms from authenticated;
revoke select on public.tariff_change_logs from authenticated;
revoke select on public.waitlist_signups from authenticated;

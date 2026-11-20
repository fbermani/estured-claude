-- EstuRed — Migración 0085: endurecimiento de funciones (advisors de Supabase + auditoría de seguridad 2026-11-11: B8)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción. NO está aplicada.
--    Es IDEMPOTENTE (alter function / revoke se pueden correr dos veces) y no toca datos.
--
-- QUÉ HACE
--   a) `set_updated_at()` y `enforce_owner_residence_limit()` quedan con `search_path` fijo (advisor "function_search_path_mutable").
--      Se usa `search_path = ''` porque ninguna referencia tablas sin calificar: `set_updated_at` solo toca `new.updated_at` y `now()`;
--      `enforce_owner_residence_limit` califica `public.residence_users` y el resto (`count`, `hashtext`, `pg_advisory_xact_lock`) vive en pg_catalog,
--      que siempre se resuelve aunque el search_path sea vacío.
--   b) `rooms_enforce_gender()` es función de TRIGGER (security definer, 0057): no debe poder invocarse por RPC. Se revoca EXECUTE
--      a public/anon/authenticated; el trigger sigue funcionando (los triggers no requieren EXECUTE del rol que escribe).
--   c) (comentado, no ejecutable) B8: leer el secreto del cron desde Supabase Vault en vez de guardarlo en texto plano en `cron.job.command`.

alter function public.set_updated_at() set search_path = '';
alter function public.enforce_owner_residence_limit() set search_path = '';

revoke execute on function public.rooms_enforce_gender() from public, anon, authenticated;

-- ==== (c) B8 — Cron de producción leyendo el secreto desde Vault (COMENTADO: ejecutar a mano en producción) ====
-- La 0013 guarda `Bearer <CRON_SECRET>` en texto plano en `cron.job.command`. En producción el job debe crearse leyendo del Vault
-- (`node scripts/build-bootstrap.mjs prod` ya genera esta variante). Para un proyecto ya bootstrapeado:
--
--   -- 1) Guardar el secreto una sola vez (mismo valor que CRON_SECRET en Vercel):
--   select vault.create_secret('REEMPLAZAR-CON-TU-CRON-SECRET', 'cron_secret');
--
--   -- 2) Reprogramar el job leyendo el secreto en cada ejecución:
--   select cron.unschedule('expire-stale-records-hourly');
--   select cron.schedule(
--     'expire-stale-records-hourly',
--     '0 * * * *',
--     $job$
--     select net.http_get(
--       url := 'https://REEMPLAZAR-CON-TU-DOMINIO/api/cron/expire-stale-records',
--       headers := jsonb_build_object(
--         'Authorization',
--         'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
--       )
--     );
--     $job$
--   );
--
-- Verificación (el comando del job ya no debe contener el secreto):
-- select jobname, command from cron.job where jobname = 'expire-stale-records-hourly';

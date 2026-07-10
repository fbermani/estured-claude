-- EstuRed — Migración 0013: job de vencimiento a 48h (pg_cron)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/07_API_SPEC.md §9.4, §15.6, §15.10, §17.2 y §31 (tabla de
-- jobs automáticos del MVP), docs/00_DECISION_LOG.md §9.1 y §865
-- (decisión ya tomada: Supabase pg_cron, "necesario porque hay jobs
-- horarios de vencimiento que el plan gratuito de Vercel Cron no
-- soporta"), docs/11_TECH_ARCHITECTURE.md §27.3 (ya anticipaba
-- `CRON_SECRET` en las env vars esperadas).
--
-- Decisión de implementación (no ambigüedad bloqueante, análisis
-- propio): docs/00 solo decide el DISPARADOR (pg_cron), no si la
-- lógica de vencimiento debe vivir en SQL o en la app. Se eligió
-- reusar el mismo patrón "Internal Action" en TypeScript ya establecido
-- (confirmReservationAfterFeePaid, Ciclo 11) en vez de reimplementar
-- las reglas de negocio y `createAuditLog` en plpgsql — evita duplicar
-- lógica en dos lenguajes, y `docs/11 §27.3` ya anticipaba `CRON_SECRET`
-- para un endpoint HTTP, no una función SQL pura. pg_cron dispara un
-- `net.http_get` (extensión pg_net, incluida en el plan gratuito de
-- Supabase) contra `/api/cron/expire-stale-records`, protegido por ese
-- secret.
--
-- Los 4 jobs de vencimiento a 48h (docs/07 §31) corren en un solo
-- request — misma frecuencia, menos superficie operativa (un secret,
-- un webhook) sin perder separación de responsabilidades a nivel de
-- código (cada uno vive en su propio archivo bajo lib/jobs/).
--
-- ⚠️ Antes de correr esta migración: reemplazar los dos placeholders de
-- abajo (URL de producción y el mismo valor que `CRON_SECRET` en
-- Vercel) — sin eso, el schedule queda creado pero le va a pegar a una
-- URL que no existe. Para reprogramar después de corregirlos:
--   select cron.unschedule('expire-stale-records-hourly');
-- y volver a correr el bloque de `cron.schedule` con los valores
-- correctos.

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.schedule(
  'expire-stale-records-hourly',
  '0 * * * *', -- cada hora en punto (granularidad aceptada por docs/00 §865)
  $$
  select net.http_get(
    url := 'https://REEMPLAZAR-CON-TU-DOMINIO.vercel.app/api/cron/expire-stale-records',
    headers := jsonb_build_object('Authorization', 'Bearer REEMPLAZAR-CON-TU-CRON-SECRET')
  );
  $$
);

-- Verificación (debería mostrar 1 fila con el schedule activo):
-- select jobid, jobname, schedule, active from cron.job where jobname = 'expire-stale-records-hourly';

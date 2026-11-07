-- EstuRed — Migración 0078: estado `expired` de la lista de espera (DR40)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. Es ADITIVA e IDEMPOTENTE.
--    Ejecutala SOLA (sin otras sentencias en la misma consulta): Postgres no deja usar un valor nuevo de un enum en la misma
--    transacción que lo agrega. Esta migración no lo usa.
--    Hasta que se aplique, el job de vencimiento falla en silencio (loguea el error) y las vistas igual ocultan las entradas con mes
--    ya terminado (defensa en profundidad), así que nada se rompe.
--
-- QUÉ HACE
--   Agrega el valor `expired` al enum `waitlist_status`: la entrada que sale sola de la lista porque pasó el mes de ingreso que el
--   estudiante eligió (`desired_start_date` = día 1 de ese mes; `removed_reason = 'month_passed'`). Fuente: docs/00 DR40.
--   Sin cambios de columnas ni de RLS (las policies de `waitlist_entries` no dependen del valor del estado).
--
-- CÓMO REVERTIR
--   Postgres no permite quitar un valor de un enum. Para "apagar" la regla alcanza con sacar `expireWaitlistByMonth` de
--   `lib/jobs/runExpirationJobs.ts`; el valor sobrante es inofensivo. Si hubiera filas `expired` y se quisiera reabrirlas:
--     update public.waitlist_entries set status = 'active', removed_at = null, removed_reason = null where status = 'expired';

alter type public.waitlist_status add value if not exists 'expired';

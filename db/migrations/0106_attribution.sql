-- EstuRed — Migración 0106: atribución first-party de la preapertura (Paso 0 del runbook, «Medición sin Meta»)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: la aplica el dueño (en producción entra sola con scripts/build-bootstrap.mjs al armar el proyecto).
--    Es ADITIVA e IDEMPOTENTE (add column if not exists) y no toca datos. Necesita 0066 y 0080 aplicadas.
--
-- QUÉ HACE
--   Agrega `attribution jsonb` (nullable) a las dos tablas donde se captura un lead de la preapertura:
--     1. `preapertura_estudiantes`   (preregistro de estudiante, role = 'student', y de familiar, role = 'family').
--     2. `residence_signup_requests` (solicitud de residencia fundadora).
--   Contenido: solo las claves utm_source, utm_medium, utm_campaign, utm_content, utm_term y fbclid, cada una recortada a 100
--   caracteres y saneada en el servidor (lib/attribution/attribution.ts). Primer toque, leída de la cookie propia `er-attr`.
--   Sin datos personales. Es NULL si el visitante llegó sin parámetros de campaña.
--
-- SEGURIDAD
--   Ambas tablas tienen RLS sin policies y sin grants para anon/authenticated (0081): solo las lee el service role / el admin por
--   server action. NO se da `grant select (attribution)` a `authenticated` a propósito.
--
-- CÓDIGO ANTES QUE MIGRACIÓN: si la columna todavía no existe, el alta sigue funcionando y guarda sin atribución.

alter table public.preapertura_estudiantes
  add column if not exists attribution jsonb
  check (attribution is null or (jsonb_typeof(attribution) = 'object' and octet_length(attribution::text) <= 1000));

alter table public.residence_signup_requests
  add column if not exists attribution jsonb
  check (attribution is null or (jsonb_typeof(attribution) = 'object' and octet_length(attribution::text) <= 1000));

comment on column public.preapertura_estudiantes.attribution is
  'Atribución de campaña (utm_* y fbclid, primer toque, saneada en el servidor). Sin datos personales. Solo service role.';
comment on column public.residence_signup_requests.attribution is
  'Atribución de campaña (utm_* y fbclid, primer toque, saneada en el servidor). Sin datos personales. Solo service role.';

-- Verificación (debe devolver 2 filas, sin grants a authenticated):
--   select table_name, column_name from information_schema.columns
--    where table_schema = 'public' and column_name = 'attribution' and table_name in ('preapertura_estudiantes', 'residence_signup_requests');
--   select grantee, column_name from information_schema.column_privileges
--    where table_schema = 'public' and column_name = 'attribution' and grantee in ('anon', 'authenticated');   -- 0 filas

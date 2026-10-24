-- EstuRed — Migración 0049: resolución de la revocación del fee por el admin + caso de Soporte "fee_revocation" (Ciclo 68, DR6)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). Orden pendiente: 0045, 0046, 0047, 0048, 0049.
--    NO está aplicada. Es ADITIVA e IDEMPOTENTE (add column if not exists, drop/add constraint) y no toca datos existentes.
--    Hasta que se aplique, el código degrada con gracia: la pestaña Revocaciones del admin se ve en modo lectura con un aviso, el
--    estudiante ve su revocación "en revisión" y revocar sigue funcionando (el caso de Soporte automático simplemente no se abre).
--
-- MOTIVO. DR6 (docs/00 §31): si el estudiante revoca el fee dentro de los 10 días corridos de pagado, EstuRed reintegra el fee completo
-- previa resolución del admin con motivo obligatorio. Hoy la revocación deja la reserva cancelada y el fee `paid`, sin ningún registro
-- de lo que el admin decidió después. Esta migración agrega dónde guardar esa resolución. NO agrega estados al fee: `estured_fee_status`
-- ya tiene `refunded` (0010) y "pendiente de resolver" se deriva de (reserva revocada + fee `paid` + `revocation_resolution is null`).
--
-- QUÉ HACE
--   1. `estured_fee_payments`: columnas de la resolución (todas nullable; las escribe SOLO el service role desde la server action):
--        revocation_resolution       'refunded' | 'denied'   (null = sin resolver)
--        revocation_resolved_at      cuándo
--        revocation_resolved_by      admin (users.id)
--        revocation_internal_reason  motivo interno, 10 a 1000 caracteres (NUNCA visible al estudiante)
--        revocation_student_message  mensaje opcional para el estudiante, hasta 1000 caracteres
--        refund_amount_ars           monto reintegrado (el fee completo)
--        refund_method               'bank_transfer' | 'digital_wallet' | 'other'
--        refund_reference            referencia de la operación (3 a 120 caracteres)
--      `refunded_at` ya existía (0010) y guarda la FECHA del reintegro que informa el admin; `refund_reason` también existía pero NO se usa
--      para la revocación: es legible por el estudiante y por el staff de la residencia (0047), y el motivo interno no puede serlo.
--      CHECK de coherencia: una resolución exige quién, cuándo y motivo interno; un reintegro exige además fecha, monto, medio y referencia;
--      una denegación no puede traer datos de reintegro.
--   2. Privacidad / grants. La 0047 ya revocó el SELECT de tabla a `anon` y `authenticated` y concede SELECT solo por columnas
--      enumeradas. Las columnas nuevas NO se conceden: quedan legibles solo por el service role. La pantalla del estudiante lee la
--      resolución y el mensaje con el service role, después de comprobar por RLS que la reserva es suya. Escrituras: no hay policies de
--      INSERT/UPDATE/DELETE en esta tabla, así que `authenticated` no puede escribir; por defensa en profundidad se revocan igual los
--      privilegios de escritura de `anon` y `authenticated` (el service role no se ve afectado).
--      ⚠ Si la 0047 todavía NO está aplicada, el SELECT de tabla sigue concedido y las columnas nuevas serían legibles por la API para
--      quien la policy deja ver la fila (estudiante, familiar vinculado, staff de la residencia). Aplicar la 0047 ANTES que la 0049.
--   3. `support_cases.topic` admite `fee_revocation` (el caso que se abre solo al revocar). Misma forma que `estured_fee_payment` (0040):
--      sin `residence_id` (la residencia nunca lo ve: su policy de SELECT filtra por residence_id y un NULL no coincide) y con la reserva
--      como contexto (`related_entity_type = 'reservations'` + `related_entity_id`). Al resolver la revocación el caso se cierra.
--
-- NO hay backfill: las revocaciones anteriores (reserva `cancelled_by_student` + `student_revocation_right`, fee `paid`) quedan como
-- "pendientes" automáticamente porque `revocation_resolution` es null. No tienen caso de Soporte (se abre solo para las nuevas).
--
-- REVERTIR (solo si no se resolvió ninguna revocación real, porque borra esas columnas):
--   alter table public.estured_fee_payments
--     drop constraint if exists estured_fee_payments_revocation_resolution_shape_check,
--     drop column if exists revocation_resolution, drop column if exists revocation_resolved_at, drop column if exists revocation_resolved_by,
--     drop column if exists revocation_internal_reason, drop column if exists revocation_student_message,
--     drop column if exists refund_amount_ars, drop column if exists refund_method, drop column if exists refund_reference;
--   (los casos con topic = 'fee_revocation' hay que borrarlos o pasarlos a otro topic antes de volver al CHECK de la 0040:)
--   -- delete from public.support_cases where topic = 'fee_revocation';
--   alter table public.support_cases drop constraint if exists support_cases_topic_check;
--   alter table public.support_cases add constraint support_cases_topic_check check (topic in ('residence_claim', 'estured_fee_payment'));
--   alter table public.support_cases drop constraint if exists support_cases_topic_shape_check;
--   alter table public.support_cases add constraint support_cases_topic_shape_check check (
--     (topic = 'residence_claim' and residence_id is not null and terms_reminder_accepted_at is not null)
--     or (topic = 'estured_fee_payment' and residence_id is null and related_entity_type = 'reservations' and related_entity_id is not null));

begin;

-- ==== 0. Guarda de orden: la 0047 (revoca el SELECT de tabla) tiene que estar aplicada antes ====
do $$
begin
  if has_table_privilege('authenticated', 'public.estured_fee_payments', 'SELECT')
     or has_table_privilege('anon', 'public.estured_fee_payments', 'SELECT') then
    raise exception '0049: aplicá antes la 0047 (SELECT de tabla todavía concedido)';
  end if;
end
$$;

-- ==== 1. Resolución de la revocación en el pago del fee ====
alter table public.estured_fee_payments
  add column if not exists revocation_resolution text,
  add column if not exists revocation_resolved_at timestamptz,
  add column if not exists revocation_resolved_by uuid references public.users (id),
  add column if not exists revocation_internal_reason text,
  add column if not exists revocation_student_message text,
  add column if not exists refund_amount_ars numeric(14, 2),
  add column if not exists refund_method text,
  add column if not exists refund_reference text;

alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_revocation_resolution_check;
alter table public.estured_fee_payments add constraint estured_fee_payments_revocation_resolution_check
  check (revocation_resolution is null or revocation_resolution in ('refunded', 'denied'));

alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_refund_method_check;
alter table public.estured_fee_payments add constraint estured_fee_payments_refund_method_check
  check (refund_method is null or refund_method in ('bank_transfer', 'digital_wallet', 'other'));

alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_revocation_texts_check;
alter table public.estured_fee_payments add constraint estured_fee_payments_revocation_texts_check
  check (
    (revocation_internal_reason is null or char_length(revocation_internal_reason) between 10 and 1000)
    and (revocation_student_message is null or char_length(revocation_student_message) <= 1000)
    and (refund_reference is null or char_length(refund_reference) between 3 and 120)
  );

-- Forma de la resolución: sin resolución no hay datos de resolución; con resolución, quién/cuándo/motivo; un reintegro además trae
-- fecha, monto, medio y referencia (y el fee en `refunded`); una denegación no trae datos de reintegro y el fee sigue `paid`.
alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_revocation_resolution_shape_check;
alter table public.estured_fee_payments add constraint estured_fee_payments_revocation_resolution_shape_check
  check (
    (revocation_resolution is null
      and revocation_resolved_at is null
      and revocation_resolved_by is null
      and revocation_internal_reason is null
      and revocation_student_message is null
      and refund_amount_ars is null
      and refund_method is null
      and refund_reference is null)
    or
    (revocation_resolution = 'refunded'
      and status = 'refunded'
      and revocation_resolved_at is not null
      and revocation_resolved_by is not null
      and revocation_internal_reason is not null
      and refunded_at is not null
      and refund_amount_ars is not null
      and refund_amount_ars = fee_amount_ars
      and refund_amount_ars > 0
      and refund_method is not null
      and refund_reference is not null)
    or
    (revocation_resolution = 'denied'
      and status = 'paid'
      and revocation_resolved_at is not null
      and revocation_resolved_by is not null
      and revocation_internal_reason is not null
      and refunded_at is null
      and refund_amount_ars is null
      and refund_method is null
      and refund_reference is null)
  );

comment on column public.estured_fee_payments.revocation_resolution is
  'Resolución del admin sobre la revocación del fee (DR6): refunded | denied; null = sin resolver. Solo service role.';
comment on column public.estured_fee_payments.revocation_internal_reason is
  'Motivo interno obligatorio de la resolución (10-1000). NUNCA visible al estudiante ni a la residencia. Solo service role.';
comment on column public.estured_fee_payments.revocation_student_message is
  'Mensaje opcional del admin para el estudiante (<=1000). Único texto de la resolución que ve el estudiante. Solo service role.';

-- ==== 2. Defensa en profundidad: nadie con la anon key / JWT escribe en el pago del fee ====
-- (Ya no hay policies de escritura sobre la tabla; esto solo cierra también el privilegio. El service role no se toca.)
revoke insert, update, delete on public.estured_fee_payments from anon, authenticated;

-- ==== 3. Caso de Soporte de la revocación ====
alter table public.support_cases drop constraint if exists support_cases_topic_check;
alter table public.support_cases add constraint support_cases_topic_check
  check (topic in ('residence_claim', 'estured_fee_payment', 'fee_revocation'));

alter table public.support_cases drop constraint if exists support_cases_topic_shape_check;
alter table public.support_cases add constraint support_cases_topic_shape_check check (
  (topic = 'residence_claim'
    and residence_id is not null
    and terms_reminder_accepted_at is not null)
  or
  (topic in ('estured_fee_payment', 'fee_revocation')
    and residence_id is null
    and related_entity_type = 'reservations'
    and related_entity_id is not null)
);

comment on column public.support_cases.topic is
  'residence_claim = reclamo sobre una residencia (con recordatorio de términos); estured_fee_payment = problema con el pago del fee, dirigido a EstuRed (sin residencia); fee_revocation = revocación del fee abierta automáticamente al revocar (sin residencia; se cierra al resolverla, DR6).';

commit;

-- Verificación (descomentar y correr aparte):
-- 1) Columnas nuevas y que NO son legibles por el usuario (esperado: 8 filas en la 1.ª query y 0 filas en la 2.ª):
--   select column_name from information_schema.columns
--     where table_schema = 'public' and table_name = 'estured_fee_payments'
--       and column_name in ('revocation_resolution','revocation_resolved_at','revocation_resolved_by','revocation_internal_reason',
--                           'revocation_student_message','refund_amount_ars','refund_method','refund_reference');
--   select column_name from information_schema.column_privileges
--     where table_schema = 'public' and table_name = 'estured_fee_payments' and grantee = 'authenticated' and privilege_type = 'SELECT'
--       and column_name in ('revocation_resolution','revocation_resolved_at','revocation_resolved_by','revocation_internal_reason',
--                           'revocation_student_message','refund_amount_ars','refund_method','refund_reference');
-- 2) Sin privilegios de escritura para anon/authenticated (esperado: 0 filas):
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema = 'public' and table_name = 'estured_fee_payments'
--       and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
-- 3) Topic nuevo aceptado (esperado: el CHECK incluye fee_revocation):
--   select pg_get_constraintdef(oid) from pg_constraint where conname in ('support_cases_topic_check', 'support_cases_topic_shape_check');
-- 4) Revocaciones pendientes que ya existían (esperado en dev: la de Camila del 20/10):
--   select r.id, r.cancelled_at, f.status, f.fee_amount_ars from public.reservations r
--     join public.estured_fee_payments f on f.id = r.estured_fee_payment_id
--     where r.status = 'cancelled_by_student' and r.cancellation_reason_code = 'student_revocation_right' and f.revocation_resolution is null;
-- Por API (JWT de un estudiante): GET /rest/v1/estured_fee_payments?select=revocation_internal_reason → 401/403 "permission denied for table"

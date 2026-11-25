-- EstuRed — Migración 0110: tope de reaperturas y escalado a 7 días del cobro de la reserva y del fee (DR66, 2026-11-25)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla en producción cuando se arme (entra sola con scripts/build-bootstrap.mjs).
--    En estured-dev la aplica el agente. Es ADITIVA e IDEMPOTENTE y no toca datos. Necesita 0102 y 0105 aplicadas.
--
-- 1) `reopen_count`: cuántas veces se reabrió el pago. Tope de 2 en el código (`lib/payments/reopenCap.ts`), que lo hace cumplir con
--    compare-and-set sobre esta columna. No hay CHECK de máximo: subir el tope no debe exigir otra migración. Solo `>= 0`.
--    Reserva (`external_residence_payments`): cuenta «Volver a habilitar el pago» de la residencia.
--    Fee (`estured_fee_payments`): cuenta la reapertura de un fee vencido, la reapertura tras «No recibí el pago» y «Reabrir el pago»
--    como respuesta a «No pude realizar el pago». No cuenta «Contactar al pagador» ni «Contactar por WhatsApp».
-- 2) `admin_escalated_at`: marca del escalado a los 7 días sin respuesta a todos los superadmin (una sola vez, idempotente). El job la reclama
--    con un update condicional (`is null`) y la devuelve si el aviso no salió. Se limpia en cada evento nuevo, como las otras marcas.
--    No hay vencimiento a los 7 días: el aviso sin respuesta solo escala.
-- 3) Ninguna columna se concede a `anon` ni a `authenticated` (ambas tablas usan grants por columna desde 0081/0102/0105: una columna nueva
--    sin `grant select (col)` queda solo para service role, que es lo que se quiere). NO repetir un `revoke select` de tabla.
-- 4) `application_requests.preferred_payment_method`: sin cambio de esquema. La opción «Otro» del estudiante se guarda con la clave reservada
--    `alternative` (cumple el CHECK de 0102 `^[a-z][a-z0-9_]{1,39}$`). NO es la clave `other` del catálogo (ese medio lo configura la residencia
--    con nombre propio). Null pasa a significar «sin preferencia» (antes: «Lo coordino con la residencia», que «Otro» absorbe). Solo se actualiza el comentario.
--
-- REVERTIR:
--   alter table public.external_residence_payments drop constraint if exists external_residence_payments_dr66_checks;
--   alter table public.external_residence_payments drop column if exists reopen_count, drop column if exists admin_escalated_at;
--   alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_dr66_checks;
--   alter table public.estured_fee_payments drop column if exists reopen_count, drop column if exists admin_escalated_at;

begin;

do $$
begin
  if to_regclass('public.external_residence_payments') is null then
    raise exception '0110: falta external_residence_payments (migración 0010)';
  end if;
  if to_regclass('public.estured_fee_payments') is null then
    raise exception '0110: falta estured_fee_payments (migración 0010)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'external_residence_payments' and column_name = 'admin_alert_sent_at'
  ) then
    raise exception '0110: falta 0102 (external_residence_payments.admin_alert_sent_at)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'estured_fee_payments' and column_name = 'admin_alert_sent_at'
  ) then
    raise exception '0110: falta 0105 (estured_fee_payments.admin_alert_sent_at)';
  end if;
end
$$;

-- ==== 1. Reserva: external_residence_payments ====
alter table public.external_residence_payments add column if not exists reopen_count integer not null default 0;
alter table public.external_residence_payments add column if not exists admin_escalated_at timestamptz;

alter table public.external_residence_payments drop constraint if exists external_residence_payments_dr66_checks;
alter table public.external_residence_payments add constraint external_residence_payments_dr66_checks check (reopen_count >= 0);

comment on column public.external_residence_payments.reopen_count is
  'DR66 (a): veces que la residencia volvió a habilitar el pago tras «No pude realizar el pago». Tope 2 (en código); después solo Soporte. Solo service role.';
comment on column public.external_residence_payments.admin_escalated_at is
  'DR66 (a): marca del escalado a los 7 días sin respuesta a todos los superadmin (una vez). Se limpia en cada evento nuevo. No vence nada. Solo service role.';

-- ==== 2. Fee: estured_fee_payments ====
alter table public.estured_fee_payments add column if not exists reopen_count integer not null default 0;
alter table public.estured_fee_payments add column if not exists admin_escalated_at timestamptz;

alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_dr66_checks;
alter table public.estured_fee_payments add constraint estured_fee_payments_dr66_checks check (reopen_count >= 0);

comment on column public.estured_fee_payments.reopen_count is
  'DR66 (a): veces que se reabrió el pago del fee (vencido, tras «No recibí el pago» o «Reabrir el pago»). Tope 2 (en código). Solo service role.';
comment on column public.estured_fee_payments.admin_escalated_at is
  'DR66 (a): marca del escalado a los 7 días sin respuesta a todos los superadmin (una vez). Se limpia en cada evento nuevo. No vence nada. Solo service role.';

-- ==== 3. «Otro» del estudiante: solo se actualiza el comentario (sin cambio de esquema) ====
comment on column public.application_requests.preferred_payment_method is
  'DR63 (c) + DR66 (b): clave del catálogo que prefiere el estudiante, o la clave reservada «alternative» («Otro»: la residencia lo contacta para definir una forma de pago alternativa). Opcional y no vinculante. Null = sin preferencia.';

commit;

-- VERIFICACIONES POST-APLICACIÓN (SQL Editor, como postgres). Cada consulta indica el resultado esperado.
--
-- 1. Privilegios → esperado: las 4 en false (columnas internas, solo service role).
--   select
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'reopen_count', 'select')       as debe_ser_false_1,
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'admin_escalated_at', 'select')  as debe_ser_false_2,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'reopen_count', 'select')               as debe_ser_false_3,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'admin_escalated_at', 'select')         as debe_ser_false_4;
--
-- 2. Columnas creadas con su default → esperado: 4 filas; reopen_count con default 0 y NOT NULL (is_nullable = NO).
--   select table_name, column_name, is_nullable, column_default from information_schema.columns
--   where table_schema = 'public' and table_name in ('external_residence_payments', 'estured_fee_payments')
--     and column_name in ('reopen_count', 'admin_escalated_at') order by 1, 2;

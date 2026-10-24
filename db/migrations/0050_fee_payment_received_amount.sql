-- EstuRed — Migración 0050: monto recibido, "confirmado sin comprobante" y quién validó el pago manual del fee (Ciclo 71, DR8)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). Orden pendiente: 0046, 0045, 0047, 0048, 0049, 0050.
--    NO está aplicada. Es ADITIVA e IDEMPOTENTE (add column if not exists, drop/add constraint) y no toca datos existentes.
--    Hasta que se aplique, el código degrada con gracia: "Marcar pagado" sigue funcionando con todas las validaciones nuevas (comprobante u
--    override, monto recibido, confirmación, plazo), pero el monto recibido, el flag de "sin comprobante" y el admin que validó quedan SOLO en
--    el audit log y no en la fila del pago.
--
-- MOTIVO. DR8 (docs/00 §31): al validar a mano el pago del fee el admin carga el monto realmente recibido y, si no hay comprobante, usa el
-- override "Confirmar sin comprobante". Hoy solo se guardaba la moneda (`payment_currency`, 0010) y el motivo en el audit log. Esta migración
-- agrega dónde guardar esos datos en el registro del pago. La MONEDA del pago recibido sigue siendo `payment_currency` (ya existe).
--
-- QUÉ HACE
--   1. `estured_fee_payments`: columnas nuevas (las escribe SOLO el service role desde la server action de /admin/payments):
--        received_amount             monto realmente recibido, en `payment_currency` (numeric(14,2), > 0 si no es null)
--        confirmed_without_receipt   true si el admin validó con el override "Confirmar sin comprobante" (default false)
--        validated_by_user_id        admin (users.id) que validó el pago manual
--      CHECK: `received_amount`, si existe, es mayor que 0.
--   2. Privacidad / grants. La 0047 ya revocó el SELECT de tabla a `anon` y `authenticated` y concede SELECT solo por columnas enumeradas.
--      Las columnas nuevas NO se conceden: quedan legibles solo por el service role (el estudiante, el familiar y la residencia no las ven por
--      la API). Escrituras: la 0049 ya revocó INSERT/UPDATE/DELETE a `anon` y `authenticated`; acá se repite por defensa en profundidad
--      (idempotente) para que esta migración no dependa de que la 0049 se haya aplicado.
--      ⚠ Si la 0047 todavía NO está aplicada, el SELECT de tabla sigue concedido y las columnas nuevas serían legibles por la API para quien la
--      policy deja ver la fila (estudiante, familiar vinculado, staff de la residencia). Por eso la migración aborta si la 0047 falta:
--      aplicar siempre en orden.
--
--   3. `provider_payment_id` (revisión de seguridad, Ciclo 71): la referencia que carga el admin al validar (últimos dígitos, nº de
--      operación) la concedió la 0047 a `authenticated`, o sea que la residencia y terceros la leían por API. Se revoca SU SELECT por
--      columna (aditivo; el service role no se toca). Verificado con grep (código al 2026-10-24): ninguna lectura con el cliente del
--      USUARIO pide `provider_payment_id`; solo la escriben `recordManualFeePayment` y `recordRenewalManualFeePayment` (service role).
--
-- NO hay backfill: los pagos anteriores quedan con `received_amount` null y `confirmed_without_receipt` false.
--
-- REVERTIR (borra los datos de esas columnas; el código vuelve a degradar con gracia y deja esos datos solo en el audit log):
--   alter table public.estured_fee_payments
--     drop constraint if exists estured_fee_payments_received_amount_check,
--     drop column if exists received_amount,
--     drop column if exists confirmed_without_receipt,
--     drop column if exists validated_by_user_id;
--   (Para devolver la lectura de `provider_payment_id` a los usuarios: grant select (provider_payment_id) on public.estured_fee_payments to authenticated;)

begin;

-- ==== 0. Guarda de orden: la 0047 (revoca el SELECT de tabla) tiene que estar aplicada antes ====
do $$
begin
  if has_table_privilege('authenticated', 'public.estured_fee_payments', 'SELECT')
     or has_table_privilege('anon', 'public.estured_fee_payments', 'SELECT') then
    raise exception '0050: aplicá antes la 0047 (SELECT de tabla todavía concedido)';
  end if;
end
$$;

-- ==== 1. Registro de la validación manual en el pago del fee ====
alter table public.estured_fee_payments
  add column if not exists received_amount numeric(14, 2),
  add column if not exists confirmed_without_receipt boolean not null default false,
  add column if not exists validated_by_user_id uuid references public.users (id);

alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_received_amount_check;
alter table public.estured_fee_payments add constraint estured_fee_payments_received_amount_check
  check (received_amount is null or received_amount > 0);

comment on column public.estured_fee_payments.received_amount is
  'Monto realmente recibido que cargó el admin al validar un pago manual (DR8), en payment_currency. Solo service role.';
comment on column public.estured_fee_payments.confirmed_without_receipt is
  'true si el admin validó el pago manual con el override "Confirmar sin comprobante" (DR8): sin comprobante cargado, con motivo y segunda confirmación. Solo service role.';
comment on column public.estured_fee_payments.validated_by_user_id is
  'Admin (users.id) que validó el pago manual del fee (DR8). Solo service role.';

-- ==== 2. Defensa en profundidad: nadie con la anon key / JWT escribe en el pago del fee ====
-- (Igual que la 0049; sin policies de escritura ya estaba bloqueado por RLS. El service role no se toca.)
revoke insert, update, delete on public.estured_fee_payments from anon, authenticated;

-- ==== 3. La referencia del pago (provider_payment_id) deja de ser legible con la anon key / JWT ====
-- (Revoke por columna sobre el grant por columnas de la 0047; idempotente. El service role la sigue leyendo y escribiendo.)
revoke select (provider_payment_id) on public.estured_fee_payments from authenticated;

commit;

-- Verificación (descomentar y correr aparte):
-- 1) Columnas nuevas y que NO son legibles por el usuario (esperado: 3 filas en la 1.ª query y 0 filas en la 2.ª):
--   select column_name, data_type, column_default from information_schema.columns
--     where table_schema = 'public' and table_name = 'estured_fee_payments'
--       and column_name in ('received_amount', 'confirmed_without_receipt', 'validated_by_user_id');
--   select column_name from information_schema.column_privileges
--     where table_schema = 'public' and table_name = 'estured_fee_payments' and grantee = 'authenticated' and privilege_type = 'SELECT'
--       and column_name in ('received_amount', 'confirmed_without_receipt', 'validated_by_user_id');
-- 2) Sin privilegios de escritura para anon/authenticated (esperado: 0 filas):
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema = 'public' and table_name = 'estured_fee_payments'
--       and grantee in ('anon', 'authenticated') and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
-- 3) Los pagos existentes quedaron sin monto recibido y sin override (esperado: 0 filas con valores distintos):
--   select count(*) from public.estured_fee_payments where received_amount is not null or confirmed_without_receipt;
-- 4) `provider_payment_id` ya no es legible por el usuario (esperado: 0 filas):
--   select column_name from information_schema.column_privileges
--     where table_schema = 'public' and table_name = 'estured_fee_payments' and grantee = 'authenticated' and privilege_type = 'SELECT'
--       and column_name = 'provider_payment_id';
--   Nota: tras la 0050, la 2.ª query de verificación de la 0047 ya no devuelve solo las 3 de facturación: suma `provider_payment_id` y las 3 columnas nuevas.
--   (Con la 0047 + 0050 el grant por columnas de `authenticated` queda en 30 columnas: las 31 de la 0047 menos `provider_payment_id`.)
-- Por API (JWT de un estudiante), también: GET /rest/v1/estured_fee_payments?select=provider_payment_id → 401/403 "permission denied"
-- Por API (JWT de un estudiante): GET /rest/v1/estured_fee_payments?select=received_amount → 401/403 "permission denied for table"

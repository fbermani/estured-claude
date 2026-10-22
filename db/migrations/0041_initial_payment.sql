-- EstuRed — Migración 0041: pago inicial para reservar (decisión D7 / hallazgo H08)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado).
--
-- MOTIVO. No estaba definido qué le paga el estudiante a la residencia para reservar ni cuándo: la solicitud
-- mostraba el total de la estadía, el WhatsApp hablaba de un "monto para reservar" igual a un mes y el fee iba
-- aparte. Decisión D7 (docs/00 §31, docs/06 §8.1; supuesto reversible, docs/13 §4): la residencia define en su
-- perfil un "pago inicial para reservar" — por defecto el PRIMER MES de la tarifa del tipo elegido — y se muestra
-- igual en ficha, solicitud, WhatsApp y pantalla del fee.
--
-- CAMBIO (aditivo, no destructivo; no se toca `room_types` ni `application_snapshots`).
--   - residences.reservation_initial_payment_mode:
--       'one_month'  (default) = primer mes de la tarifa del tipo elegido → comportamiento actual.
--       'custom_usd'           = monto fijo en USD, igual para todos los tipos.
--   - residences.reservation_initial_payment_usd: monto fijo en USD. Obligatorio (> 0) si el modo es
--     'custom_usd' y NULL si es 'one_month' (CHECK `residences_initial_payment_coherent`).
--   - El monto efectivo se calcula al armar el snapshot de la solicitud y queda congelado en
--     `application_snapshots.reservation_payment_amount_usd/ars` (columnas que ya existen, 0007): cambiar el
--     campo después NO altera solicitudes ni reservas ya creadas.
--   - tariff_change_logs: se agrega 'initial_payment' a los `field_name` permitidos para auditar el cambio
--     (docs/09 §9, igual que matrícula/depósito/ajuste).
--
-- REVERTIR: `alter table residences drop column reservation_initial_payment_usd, drop column
-- reservation_initial_payment_mode;` (y volver a poner el CHECK de 0028 sin 'initial_payment' si no hay filas
-- con ese valor). Las filas existentes ya quedan en 'one_month', que es el comportamiento de hoy.

alter table public.residences
  add column if not exists reservation_initial_payment_mode text not null default 'one_month',
  add column if not exists reservation_initial_payment_usd numeric(14, 2);

alter table public.residences drop constraint if exists residences_initial_payment_mode_check;
alter table public.residences add constraint residences_initial_payment_mode_check
  check (reservation_initial_payment_mode in ('one_month', 'custom_usd'));

alter table public.residences drop constraint if exists residences_initial_payment_coherent;
alter table public.residences add constraint residences_initial_payment_coherent check (
  (reservation_initial_payment_mode = 'one_month' and reservation_initial_payment_usd is null)
  or
  (reservation_initial_payment_mode = 'custom_usd'
    and reservation_initial_payment_usd is not null
    and reservation_initial_payment_usd > 0)
);

comment on column public.residences.reservation_initial_payment_mode is
  'D7/H08: pago inicial para reservar que el estudiante le hace a la residencia. one_month = primer mes de la tarifa del tipo elegido (default); custom_usd = monto fijo en USD.';
comment on column public.residences.reservation_initial_payment_usd is
  'D7/H08: monto fijo en USD del pago inicial; solo si reservation_initial_payment_mode = custom_usd.';

-- Auditoría de tarifas: permitir 'initial_payment' (el CHECK inline de 0028 se llama tariff_change_logs_field_name_check).
alter table public.tariff_change_logs drop constraint if exists tariff_change_logs_field_name_check;
alter table public.tariff_change_logs add constraint tariff_change_logs_field_name_check
  check (field_name in ('monthly_price', 'enrollment_fee', 'deposit', 'adjustment_policy', 'initial_payment'));

-- ==== Verificación (correr aparte, después del Run) ====
-- Debe devolver 2 filas (columnas nuevas) y todas las residencias existentes en 'one_month':
--   select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'residences' and column_name like 'reservation_initial_payment%';
--
--   select reservation_initial_payment_mode, count(*) from public.residences group by 1;
--
-- Debe devolver 3 constraints (modo, coherencia y field_name de tariff_change_logs):
--   select conname from pg_constraint
--   where conname in ('residences_initial_payment_mode_check', 'residences_initial_payment_coherent', 'tariff_change_logs_field_name_check');

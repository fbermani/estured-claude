-- EstuRed — Migración 0061: pago inicial «depósito» y FAQ del mes vacío (DR18, fase 2, tanda 3 — correcciones del dueño)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE; no toca filas existentes salvo el texto de FAQ-51. Necesita la 0060 (y la 0054/0056 para la FAQ).
--    Sin tablas, policies ni funciones nuevas: no cambia RLS ni grants.
--
-- QUÉ HACE
--   1. `residences.reservation_initial_payment_mode` acepta además 'deposit_only' (el pago inicial para confirmar la reserva es el
--      depósito del tipo elegido; cae al primer mes si la residencia no pide depósito). Sin monto fijo, igual que 'enrollment_only'.
--   2. `application_snapshots.empty_months_charge_usd` / `empty_months_count`: cargo de mes vacío CONFIRMADO (solo si la reserva es
--      diferida y el tipo realmente no tiene ocupación en los meses completos entre hoy y el ingreso). Entra a `fee_base_usd`. Null =
--      sin cargo (todas las solicitudes existentes).
--   3. Reescribe la respuesta sugerida de FAQ-51 («¿Qué es el mes vacío y por qué se cobra?»): solo se cobra si la reserva es diferida
--      y la plaza realmente queda sin ocupación en los meses completos entre hoy y el ingreso. Solo si la FAQ existe.
--
-- REVERTIR: alter table public.application_snapshots drop column if exists empty_months_charge_usd, drop column if exists empty_months_count; y pasar antes las filas 'deposit_only' a 'one_month' y volver a crear los CHECK de la 0060.

begin;

do $$
begin
  if to_regclass('public.residences') is null then
    raise exception '0061: falta residences';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'residences' and column_name = 'deposit_mode'
  ) then
    raise exception '0061: falta aplicar la 0060';
  end if;
end
$$;

alter table public.residences drop constraint if exists residences_initial_payment_mode_check;
alter table public.residences add constraint residences_initial_payment_mode_check
  check (reservation_initial_payment_mode in ('one_month', 'custom_usd', 'enrollment_only', 'deposit_only'));

alter table public.residences drop constraint if exists residences_initial_payment_coherent;
alter table public.residences add constraint residences_initial_payment_coherent check (
  (reservation_initial_payment_mode in ('one_month', 'enrollment_only', 'deposit_only') and reservation_initial_payment_usd is null)
  or
  (reservation_initial_payment_mode = 'custom_usd'
    and reservation_initial_payment_usd is not null
    and reservation_initial_payment_usd > 0)
);

alter table public.application_snapshots
  add column if not exists empty_months_charge_usd numeric(14, 2),
  add column if not exists empty_months_count smallint;

alter table public.application_snapshots drop constraint if exists application_snapshots_empty_months_coherent;
alter table public.application_snapshots add constraint application_snapshots_empty_months_coherent check (
  (empty_months_charge_usd is null and empty_months_count is null)
  or (empty_months_charge_usd > 0 and empty_months_count between 1 and 3)
);

comment on column public.residences.reservation_initial_payment_mode is
  'D7/H08 + DR18: pago inicial para confirmar la reserva, a la residencia. one_month = primer mes (default); custom_usd = monto fijo; enrollment_only = la matrícula vigente; deposit_only = el depósito del tipo elegido. enrollment_only y deposit_only caen al primer mes si no hay monto cobrable.';

do $$
begin
  if to_regclass('public.residence_faq_predefined_questions') is not null then
    update public.residence_faq_predefined_questions
    set suggested_answer = $a$Algunas residencias permiten reservar hoy para ingresar más adelante. En ese caso puede aplicarse un «mes vacío»: un mes completo, entre hoy y tu ingreso, en el que la plaza queda sin ocupar, y por eso la residencia cobra una parte de la mensualidad (el porcentaje lo define cada residencia). Solo se cobra si se dan las dos cosas: que la reserva sea con ingreso diferido y que la plaza realmente esté sin ocupación esos meses. Por ejemplo: si hoy es octubre y buscás para diciembre, y noviembre la plaza está ocupada, no se cobra; si buscás para enero y la plaza está libre en noviembre y diciembre, pueden cobrarse esos dos meses. Cuando la residencia no tiene la ocupación cargada, lo confirma ella y lo ves como «a confirmar» antes de enviar la solicitud. Se paga a la residencia, no a EstuRed.$a$
    where id = 'FAQ-51';
  end if;
end
$$;

commit;

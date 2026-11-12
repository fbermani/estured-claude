-- EstuRed — Migración 0082: CHECK de montos positivos (auditoría de seguridad 2026-11-11: M3)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Es IDEMPOTENTE (drop constraint if exists + add + validate) y no modifica datos; si alguna fila existente viola un CHECK,
--    el `validate constraint` falla y esa tabla queda con el CHECK `not valid` (solo rige para filas nuevas): ver filas con
--    `select * from <tabla> where not (<condición>)` antes de reintentar. Necesita 0001–0081 aplicadas.
--
-- Fuente: docs/audits/SEGURIDAD_2026-11-11.md (M3). Evita fee/precio/duración en 0 o negativos (evasión del fee, snapshots rotos).
--
-- QUÉ HACE
--   `> 0` en: fee (monto, base USD/ARS, tasa ≤ 100), precio mensual y duración de snapshots y ofertas de renovación.
--   `>= 0 o null` en los opcionales: matrícula, depósito, pago de reserva propuesto, monto reportado a la residencia.
--   Patrón: add constraint ... not valid (no escanea la tabla ni bloquea) + validate constraint (escanea sin bloqueo fuerte).

begin;

-- ===== estured_fee_payments (0010) =====
alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_amounts_positive;
alter table public.estured_fee_payments add constraint estured_fee_payments_amounts_positive check (
  fee_amount_ars > 0 and fee_base_ars > 0 and fee_base_usd > 0
  and fee_rate_percent > 0 and fee_rate_percent <= 100
  and (fee_amount_usd is null or fee_amount_usd > 0)
) not valid;

-- ===== application_snapshots (0007) =====
alter table public.application_snapshots drop constraint if exists application_snapshots_amounts_positive;
alter table public.application_snapshots add constraint application_snapshots_amounts_positive check (
  monthly_price_usd > 0 and monthly_price_ars > 0 and initial_duration_months > 0
  and (enrollment_fee_usd is null or enrollment_fee_usd >= 0)
  and (enrollment_fee_ars is null or enrollment_fee_ars >= 0)
  and (deposit_usd is null or deposit_usd >= 0)
  and (deposit_ars is null or deposit_ars >= 0)
  and (fee_base_usd is null or fee_base_usd > 0)
  and (fee_base_ars is null or fee_base_ars > 0)
  and (estimated_estured_fee_ars is null or estimated_estured_fee_ars > 0)
) not valid;

-- ===== application_negotiation_proposals (0008) =====
alter table public.application_negotiation_proposals drop constraint if exists negotiation_proposals_amounts_positive;
alter table public.application_negotiation_proposals add constraint negotiation_proposals_amounts_positive check (
  (proposed_monthly_price_usd is null or proposed_monthly_price_usd > 0)
  and (proposed_monthly_price_ars is null or proposed_monthly_price_ars > 0)
  and (proposed_enrollment_fee_usd is null or proposed_enrollment_fee_usd >= 0)
  and (proposed_enrollment_fee_ars is null or proposed_enrollment_fee_ars >= 0)
  and (proposed_deposit_usd is null or proposed_deposit_usd >= 0)
  and (proposed_deposit_ars is null or proposed_deposit_ars >= 0)
  and (proposed_duration_months is null or proposed_duration_months > 0)
  and (proposed_reservation_payment_amount_usd is null or proposed_reservation_payment_amount_usd >= 0)
) not valid;

-- ===== external_residence_payments (0010) =====
alter table public.external_residence_payments drop constraint if exists external_residence_payments_amounts_nonneg;
alter table public.external_residence_payments add constraint external_residence_payments_amounts_nonneg check (
  (amount_reported_usd is null or amount_reported_usd >= 0)
  and (amount_reported_ars is null or amount_reported_ars >= 0)
) not valid;

-- ===== renewal_offers (0016; precio y duración ya tienen > 0 inline) =====
alter table public.renewal_offers drop constraint if exists renewal_offers_amounts_positive;
alter table public.renewal_offers add constraint renewal_offers_amounts_positive check (
  fee_base_usd > 0 and fee_base_ars > 0 and estimated_estured_fee_ars > 0
  and (enrollment_or_renewal_fee_usd is null or enrollment_or_renewal_fee_usd >= 0)
  and (enrollment_or_renewal_fee_ars is null or enrollment_or_renewal_fee_ars >= 0)
  and (deposit_usd is null or deposit_usd >= 0)
  and (deposit_ars is null or deposit_ars >= 0)
) not valid;

alter table public.estured_fee_payments validate constraint estured_fee_payments_amounts_positive;
alter table public.application_snapshots validate constraint application_snapshots_amounts_positive;
alter table public.application_negotiation_proposals validate constraint negotiation_proposals_amounts_positive;
alter table public.external_residence_payments validate constraint external_residence_payments_amounts_nonneg;
alter table public.renewal_offers validate constraint renewal_offers_amounts_positive;

commit;

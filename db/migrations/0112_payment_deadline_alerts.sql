-- EstuRed — Migración 0112: alertas del plazo de pago de la reserva (DR74) y plazo nuevo de 24 h (DR73 (c)), 2026-11-27
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO en producción. En estured-dev la aplica el agente. ADITIVA e IDEMPOTENTE, no toca datos. Necesita 0102.
--
-- 1) `deadline_alert_stage`: última alerta enviada al estudiante (0 a 4: 36, 24, 12 y 6 h antes del vencimiento). El job la reclama con
--    un update condicional y la devuelve si el aviso no salió.
-- 2) `deadline_alert_for`: plazo (`application_requests.payment_deadline_at`) al que se refiere la etapa. Si el plazo cambia (se reinicia),
--    la cuenta vuelve a empezar sin que quien lo cambia tenga que limpiar nada. El plazo nuevo de 24 h la fija con la etapa 2.
-- 3) Ninguna columna se concede a `anon` ni a `authenticated` (grants por columna desde 0081/0102): quedan solo para service role.
--    NO repetir un `revoke select` de tabla.
-- Reemplaza el recordatorio de 12 h (`student_reminder_sent_at` deja de usarse; no se borra).
--
-- REVERTIR:
--   alter table public.external_residence_payments drop constraint if exists external_residence_payments_dr74_checks;
--   alter table public.external_residence_payments drop column if exists deadline_alert_stage, drop column if exists deadline_alert_for;

begin;

alter table public.external_residence_payments add column if not exists deadline_alert_stage smallint not null default 0;
alter table public.external_residence_payments add column if not exists deadline_alert_for timestamptz;

alter table public.external_residence_payments drop constraint if exists external_residence_payments_dr74_checks;
alter table public.external_residence_payments
  add constraint external_residence_payments_dr74_checks check (deadline_alert_stage between 0 and 4);

comment on column public.external_residence_payments.deadline_alert_stage is
  'DR74: última alerta del plazo enviada (0-4). Solo service role.';
comment on column public.external_residence_payments.deadline_alert_for is
  'DR74: plazo al que se refiere deadline_alert_stage. Si payment_deadline_at cambia, la cuenta vuelve a 0. Solo service role.';

commit;

-- EstuRed — Migración 0040: motivo "problema con el pago del fee" en Soporte (D2 / H02)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción.
--
-- MOTIVO. El fee EstuRed lo cobra EstuRed, no la residencia: si hay un problema con el pago, el estudiante
-- (o su familiar pagador) le escribe a EstuRed. Pero `support_cases` (0023) modela solo reclamos contra una
-- residencia: `residence_id` es NOT NULL y `terms_reminder_accepted_at` (recordatorio de términos/deslinde,
-- docs/10 §19.2) también. Un caso de pago del fee no tiene residencia ni descargo.
--
-- CAMBIO.
--   - Columna `topic`: 'residence_claim' (todo lo existente, valor por defecto) o 'estured_fee_payment'.
--     No se tocan los estados del caso (docs/04): ambos motivos usan el mismo `support_case_status`.
--   - `residence_id` y `terms_reminder_accepted_at` pasan a ser opcionales, pero el CHECK
--     `support_cases_topic_shape_check` mantiene la regla vieja para los reclamos y fija la forma del nuevo:
--       · residence_claim        → residence_id y terms_reminder_accepted_at obligatorios.
--       · estured_fee_payment    → SIN residence_id (la residencia nunca ve este caso: su policy de SELECT
--                                   filtra por residence_id y un NULL no coincide) y con la reserva como
--                                   contexto (`related_entity_type = 'reservations'` + `related_entity_id`).
--   - Las policies de 0023 no cambian: el que abre el caso lo ve (`support_cases_select_opener`) y el admin
--     lo gestiona con service role desde `/admin/support-cases`.

alter table public.support_cases alter column residence_id drop not null;
alter table public.support_cases alter column terms_reminder_accepted_at drop not null;

alter table public.support_cases add column if not exists topic text not null default 'residence_claim';

alter table public.support_cases drop constraint if exists support_cases_topic_check;
alter table public.support_cases add constraint support_cases_topic_check
  check (topic in ('residence_claim', 'estured_fee_payment'));

alter table public.support_cases drop constraint if exists support_cases_topic_shape_check;
alter table public.support_cases add constraint support_cases_topic_shape_check check (
  (topic = 'residence_claim'
    and residence_id is not null
    and terms_reminder_accepted_at is not null)
  or
  (topic = 'estured_fee_payment'
    and residence_id is null
    and related_entity_type = 'reservations'
    and related_entity_id is not null)
);

create index if not exists support_cases_topic_idx on public.support_cases (topic, status);

comment on column public.support_cases.topic is
  'residence_claim = reclamo sobre una residencia (con recordatorio de términos); estured_fee_payment = problema con el pago del fee, dirigido a EstuRed (sin residencia).';

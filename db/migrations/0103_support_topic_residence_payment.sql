-- EstuRed — Migración 0103: caso de Soporte «residence_payment» (DR63 fase 5, docs/07 §16.7 y §16.8)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla en producción cuando se arme (entra sola con scripts/build-bootstrap.mjs). En estured-dev ya está aplicada.
--    Es ADITIVA e IDEMPOTENTE (drop/add constraint) y no toca datos. Necesita 0023, 0040 y 0049 aplicadas.
--    Hasta que se aplique, el código degrada: «No recibí el pago» no abre el caso (queda registrada la disputa y el aviso al admin)
--    y la alerta de 72 h solo avisa al admin.
--
-- MOTIVO. DR63 (j) 1: si la residencia no confirma un pago que el estudiante informó («Ya pagué»), a las 72 h hay alerta al admin y un
-- caso de Soporte; y «No recibí el pago» de la residencia también abre un caso. `support_cases_topic_shape_check` (0040/0049) solo admite
-- `residence_claim` (con recordatorio de términos), `estured_fee_payment` y `fee_revocation` (ambos SIN residencia). Un caso del pago
-- a la residencia necesita residencia (para que el admin sepa de quién es) y NO lleva recordatorio de términos si lo abre el sistema.
--
-- QUÉ HACE. `support_cases.topic` admite `residence_payment`: con `residence_id`, con la solicitud como contexto
-- (`related_entity_type = 'application_requests'` + `related_entity_id`) y `terms_reminder_accepted_at` opcional. Los tres topics
-- anteriores conservan su forma. Las policies no cambian: con la API solo ve el caso quien lo abrió
-- (`support_cases_select_opener`, 0023). La residencia NO los lee por la API (0081 borró `support_cases_select_residence`): sus
-- casos, como los del admin, se leen con service role por server action. El caso automático (72 h) lo abre el sistema a nombre del
-- estudiante (`opened_by_role = 'system'`); el de
-- «No recibí el pago» lo abre la persona de la residencia que lo registra. La descripción nunca lleva datos de cobro.
--
-- REVERTIR (antes: borrar o pasar a otro topic los casos con topic = 'residence_payment'):
--   delete from public.support_cases where topic = 'residence_payment';
--   alter table public.support_cases drop constraint if exists support_cases_topic_check;
--   alter table public.support_cases add constraint support_cases_topic_check check (topic in ('residence_claim', 'estured_fee_payment', 'fee_revocation'));
--   alter table public.support_cases drop constraint if exists support_cases_topic_shape_check;
--   alter table public.support_cases add constraint support_cases_topic_shape_check check (
--     (topic = 'residence_claim' and residence_id is not null and terms_reminder_accepted_at is not null)
--     or (topic in ('estured_fee_payment', 'fee_revocation') and residence_id is null and related_entity_type = 'reservations' and related_entity_id is not null));

begin;

do $$
begin
  if to_regclass('public.support_cases') is null then
    raise exception '0103: falta support_cases (migración 0023)';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'support_cases' and column_name = 'topic'
  ) then
    raise exception '0103: falta support_cases.topic (migración 0040)';
  end if;
end
$$;

alter table public.support_cases drop constraint if exists support_cases_topic_check;
alter table public.support_cases add constraint support_cases_topic_check
  check (topic in ('residence_claim', 'estured_fee_payment', 'fee_revocation', 'residence_payment'));

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
  or
  (topic = 'residence_payment'
    and residence_id is not null
    and related_entity_type = 'application_requests'
    and related_entity_id is not null)
);

comment on column public.support_cases.topic is
  'residence_claim = reclamo sobre una residencia (con recordatorio de términos); estured_fee_payment = problema con el pago del fee, dirigido a EstuRed (sin residencia); fee_revocation = revocación del fee abierta automáticamente al revocar (sin residencia); residence_payment = pago a la residencia informado por el estudiante y sin confirmar o disputado (con residencia y la solicitud como contexto, DR63).';

-- Un solo caso ABIERTO por solicitud y motivo no se puede expresar sin conocer los estados cerrados; lo garantiza el código (idempotente).
create index if not exists support_cases_residence_payment_idx
  on public.support_cases (related_entity_id)
  where topic = 'residence_payment';

commit;

-- VERIFICACIÓN (SQL Editor, aparte) → esperado: ambos CHECK incluyen residence_payment.
--   select conname, pg_get_constraintdef(oid) from pg_constraint where conname in ('support_cases_topic_check', 'support_cases_topic_shape_check');

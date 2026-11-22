-- EstuRed — Migración 0108: endurecimiento del cobro del fee EstuRed (DR64, Pista 2, revisión de seguridad del commit 4bb5001)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla en producción cuando se arme (entra sola con scripts/build-bootstrap.mjs).
--    En estured-dev la aplica el agente. Es ADITIVA e IDEMPOTENTE y no toca datos. Necesita 0105 y 0040/0049/0103 (support_cases) aplicadas.
--
-- 1) Las 4 columnas que 0105 le concedió a `authenticated` en `estured_fee_payments` (chosen_method, student_reported_paid_at,
--    student_payment_issue_at, student_payment_issue_resolved_at) las lee el equipo de la residencia por la RLS `estured_fee_payments_select_related`
--    (0010) y le revelan estado interno del cobro de EstuRed (qué medio eligió el pagador, si avisó «Ya pagué» o «No pude realizar el pago»).
--    Ninguna pantalla las lee con cliente de usuario: todas las lecturas van por service role (`app/admin/payments/page.tsx`,
--    `lib/payments/*`, jobs). Pasan a «solo service role». Se usa solo `revoke select (columna)`: un revoke de TABLA borraría los demás
--    grants por columna (patrón 0081/0102/0104).
--
-- 2) Un solo caso de Soporte ABIERTO por reserva para el motivo `estured_fee_payment`. `openFeeReviewSupportCase` (admin/job) y
--    `openFeePaymentSupportCase` (pagador o beneficiario) buscan y luego insertan; dos pedidos a la vez podían crear dos casos. El índice
--    único parcial lo garantiza; el código trata 23505 como éxito (admin/job) o como «ya hay un caso abierto» (usuario). Si ya hubiera
--    duplicados abiertos, el índice no se crea y se avisa con un NOTICE (el código sigue siendo idempotente).
--
-- REVERTIR:
--   drop index if exists public.support_cases_estured_fee_payment_open_uniq;
--   grant select (chosen_method, student_reported_paid_at, student_payment_issue_at, student_payment_issue_resolved_at)
--     on public.estured_fee_payments to authenticated;

begin;

do $$
begin
  if to_regclass('public.estured_fee_payments') is null then
    raise exception '0108: falta estured_fee_payments';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'estured_fee_payments' and column_name = 'chosen_method'
  ) then
    raise exception '0108: falta estured_fee_payments.chosen_method (migración 0105)';
  end if;
  -- Con SELECT de TABLA, un revoke por columna no haría nada: 0047 lo convirtió a grants por columna.
  if has_table_privilege('authenticated', 'public.estured_fee_payments', 'select') then
    raise exception '0108: authenticated conserva SELECT de tabla en estured_fee_payments; aplicá 0047 primero';
  end if;
  if to_regclass('public.support_cases') is null then
    raise exception '0108: falta support_cases (migración 0023)';
  end if;
end
$$;

-- 1) Columnas internas del cobro: solo service role.
do $$
declare
  col text;
begin
  foreach col in array array['chosen_method', 'student_reported_paid_at', 'student_payment_issue_at', 'student_payment_issue_resolved_at']
  loop
    if has_column_privilege('authenticated', 'public.estured_fee_payments', col, 'select') then
      execute format('revoke select (%I) on public.estured_fee_payments from authenticated', col);
    end if;
    if has_column_privilege('anon', 'public.estured_fee_payments', col, 'select') then
      execute format('revoke select (%I) on public.estured_fee_payments from anon', col);
    end if;
  end loop;
end
$$;

comment on column public.estured_fee_payments.chosen_method is
  'DR64 (b): clave del catálogo que eligió el pagador. Se puede cambiar mientras el fee esté en pending_payment_method; al informar el pago queda fija. Sin SELECT para anon/authenticated (0108): la residencia lee esta tabla por RLS y no debe verla.';

-- 2) Un caso abierto por reserva para `estured_fee_payment`.
do $$
begin
  if exists (
    select 1
    from public.support_cases
    where topic = 'estured_fee_payment'
      and status not in ('resolved_by_agreement', 'closed_no_action', 'closed_unresolved', 'admin_action_taken')
    group by related_entity_id
    having count(*) > 1
  ) then
    raise notice '0108: hay reservas con más de un caso estured_fee_payment abierto; no se crea support_cases_estured_fee_payment_open_uniq (resolvé los duplicados y volvé a correr)';
  else
    create unique index if not exists support_cases_estured_fee_payment_open_uniq
      on public.support_cases (related_entity_id)
      where topic = 'estured_fee_payment'
        and status not in ('resolved_by_agreement', 'closed_no_action', 'closed_unresolved', 'admin_action_taken');
  end if;
end
$$;

commit;

-- VERIFICACIÓN (SQL Editor, aparte):
--   -- esperado: 4 filas, todas false
--   select column_name, has_column_privilege('authenticated', 'public.estured_fee_payments', column_name, 'select') as legible
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'estured_fee_payments'
--     and column_name in ('chosen_method', 'student_reported_paid_at', 'student_payment_issue_at', 'student_payment_issue_resolved_at');
--   -- esperado: true (control positivo)
--   select has_column_privilege('authenticated', 'public.estured_fee_payments', 'status', 'select');
--   -- esperado: 1 fila
--   select indexname from pg_indexes where indexname = 'support_cases_estured_fee_payment_open_uniq';

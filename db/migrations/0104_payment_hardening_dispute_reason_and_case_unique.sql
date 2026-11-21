-- EstuRed — Migración 0104: endurecimiento del pago a la residencia (DR63 fase 5, revisión de seguridad)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla en producción cuando se arme (entra sola con scripts/build-bootstrap.mjs).
--    En estured-dev ya está aplicada. Es ADITIVA e IDEMPOTENTE y no toca datos. Necesita 0102 y 0103 aplicadas.
--
-- 1) `external_residence_payments.dispute_reason` fuera de la API. Es texto libre que escribe la residencia al disputar («No recibí el
--    pago»). Con el grant de 0102 y la RLS de la tabla, el estudiante, el familiar vinculado y el equipo activo podían leerlo con su JWT,
--    y el texto puede traer teléfono, mail o datos de la residencia. Pasa a «solo service role», igual que `instructions_snapshot`:
--    la lectura va por server action con service role (`loadCollectionViews`, panel de la residencia). Ninguna pantalla lo lee con
--    cliente de usuario. Se usa solo `revoke select (columna)`: un revoke de TABLA borraría los demás grants por columna (patrón 0081/0102).
--
-- 2) Un solo caso de Soporte ABIERTO por solicitud para el motivo `residence_payment`. `openResidencePaymentSupportCase` busca y luego
--    inserta; dos pedidos a la vez (reintento del job de 72 h + «No recibí el pago») podían crear dos casos. El índice único parcial
--    lo garantiza en la base; el código trata 23505 como éxito (devuelve el caso abierto). Si ya hubiera duplicados abiertos (solo
--    posible por esa carrera), el índice no se crea y se avisa con un NOTICE: el código sigue siendo idempotente.
--
-- REVERTIR:
--   drop index if exists public.support_cases_residence_payment_open_uniq;
--   grant select (dispute_reason) on public.external_residence_payments to authenticated;

begin;

do $$
begin
  if to_regclass('public.external_residence_payments') is null then
    raise exception '0104: falta external_residence_payments';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'external_residence_payments' and column_name = 'instructions_snapshot'
  ) then
    raise exception '0104: falta external_residence_payments.instructions_snapshot (migración 0102)';
  end if;
  -- Si todavía hubiera SELECT de TABLA, un revoke por columna no haría nada: 0102 lo convierte a grants por columna.
  if has_table_privilege('authenticated', 'public.external_residence_payments', 'select') then
    raise exception '0104: authenticated conserva SELECT de tabla en external_residence_payments; aplicá 0102 primero';
  end if;
  if to_regclass('public.support_cases') is null then
    raise exception '0104: falta support_cases (migración 0023)';
  end if;
end
$$;

-- 1) dispute_reason: solo service role.
do $$
begin
  if has_column_privilege('authenticated', 'public.external_residence_payments', 'dispute_reason', 'select') then
    revoke select (dispute_reason) on public.external_residence_payments from authenticated;
  end if;
  if has_column_privilege('anon', 'public.external_residence_payments', 'dispute_reason', 'select') then
    revoke select (dispute_reason) on public.external_residence_payments from anon;
  end if;
end
$$;

comment on column public.external_residence_payments.dispute_reason is
  'Motivo (texto libre) con el que la residencia disputó el pago. Sin grant select a authenticated/anon (0104): solo la lee el service role, por server action, para el panel de la residencia.';

-- 2) Un caso abierto por solicitud para `residence_payment`.
do $$
begin
  if exists (
    select 1
    from public.support_cases
    where topic = 'residence_payment'
      and status not in ('resolved_by_agreement', 'closed_no_action', 'closed_unresolved', 'admin_action_taken')
    group by related_entity_id
    having count(*) > 1
  ) then
    raise notice '0104: hay solicitudes con más de un caso residence_payment abierto; no se crea support_cases_residence_payment_open_uniq (resolvé los duplicados y volvé a correr)';
  else
    create unique index if not exists support_cases_residence_payment_open_uniq
      on public.support_cases (related_entity_id)
      where topic = 'residence_payment'
        and status not in ('resolved_by_agreement', 'closed_no_action', 'closed_unresolved', 'admin_action_taken');
  end if;
end
$$;

commit;

-- VERIFICACIÓN (SQL Editor, aparte):
--   -- esperado: false
--   select has_column_privilege('authenticated', 'public.external_residence_payments', 'dispute_reason', 'select');
--   -- esperado: true (control positivo)
--   select has_column_privilege('authenticated', 'public.external_residence_payments', 'status', 'select');
--   -- esperado: 1 fila
--   select indexname from pg_indexes where indexname = 'support_cases_residence_payment_open_uniq';

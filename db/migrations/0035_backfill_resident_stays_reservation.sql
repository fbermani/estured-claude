-- EstuRed — Migración 0035: backfill de resident_stays.reservation_id
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Contexto (Ciclo 42): `resident_stays.reservation_id` (FK a
-- reservations) existe desde la migración 0019 y tiene unicidad parcial
-- desde la 0020, pero ningún flujo real lo poblaba — createResidentStay
-- recibía siempre `null` y activateResidentStay no lo tocaba. Resultado:
-- desde el panel de Residentes no se podía saber qué reserva (ni qué
-- renewal_offers/renewal_requests, que cuelgan de reserva) corresponde a
-- cada estadía. El código nuevo (lib/residents/linkReservation.ts) vincula
-- al crear y al activar; esta migración completa las filas YA existentes.
--
-- Incluye un paso 2 (Ciclo 43, ver abajo) que extiende el contrato de
-- las estadías con renovación ya confirmada.
--
-- NO cambia el esquema: solo datos. Es idempotente (re-correrla no hace
-- nada nuevo) y reversible (los vínculos son nullable; ver el rollback al
-- final).
--
-- Regla (la misma que usa el código): una estadía actual sin reserva se
-- vincula a la reserva `confirmed` del MISMO estudiante en la MISMA
-- residencia, solo si (a) esa es la única reserva confirmada del par
-- estudiante+residencia, (b) ninguna otra estadía actual ya la referencia
-- y (c) ninguna otra estadía sin vincular compite por la misma reserva.
-- El estudiante de una estadía sin activar se resuelve por `invite_email`.
-- Ante cualquier ambigüedad NO se vincula (una estadía "sin reserva" es un
-- estado válido y ya soportado; un vínculo equivocado no lo es).

with stay_student as (
  select
    rs.id as stay_id,
    rs.residence_id,
    coalesce(rs.student_profile_id, sp.id) as student_profile_id
  from public.resident_stays rs
  left join public.users u
    on rs.student_profile_id is null
   and lower(u.email) = lower(rs.invite_email)
  left join public.student_profiles sp on sp.user_id = u.id
  where rs.is_current = true
    and rs.reservation_id is null
),
pairs as (
  select
    ss.stay_id,
    r.id as reservation_id,
    count(*) over (partition by ss.stay_id) as reservations_per_stay,
    count(*) over (partition by r.id) as stays_per_reservation
  from stay_student ss
  join public.reservations r
    on r.residence_id = ss.residence_id
   and r.student_profile_id = ss.student_profile_id
   and r.status = 'confirmed'
  where ss.student_profile_id is not null
    and not exists (
      select 1 from public.resident_stays other
      where other.reservation_id = r.id and other.is_current = true
    )
)
update public.resident_stays rs
set reservation_id = p.reservation_id
from pairs p
where rs.id = p.stay_id
  and p.reservations_per_stay = 1
  and p.stays_per_reservation = 1;

-- Paso 2 (Ciclo 43): contrato extendido por renovaciones ya confirmadas.
-- Hasta el Ciclo 42, extendResidentStayOnRenewal escribía `end_date`
-- (salida REAL) en vez de `expected_end_date` ("Contrato hasta", lo que
-- muestra la UI), y además casi ninguna estadía tenía reservation_id —
-- así que ninguna renovación confirmada había extendido el contrato.
-- Ya con el vínculo del paso 1, lleva expected_end_date al fin de la
-- renovación confirmada más larga de su reserva. Nunca acorta un
-- contrato; idempotente.
update public.resident_stays rs
set expected_end_date = ro.max_end
from (
  select reservation_id, max(period_end_date) as max_end
  from public.renewal_offers
  where status in ('confirmed', 'receipt_issued')
  group by reservation_id
) ro
where rs.reservation_id = ro.reservation_id
  and rs.is_current = true
  and (rs.expected_end_date is null or rs.expected_end_date < ro.max_end);

-- Verificación (solo lectura): cuántas estadías actuales quedaron
-- vinculadas / sin vincular. Las "sin vincular" son esperables para
-- residentes cargados a mano sin reserva de EstuRed.
-- select
--   count(*) filter (where reservation_id is not null) as vinculadas,
--   count(*) filter (where reservation_id is null)     as sin_reserva
-- from public.resident_stays where is_current = true;

-- Rollback (solo si hiciera falta deshacer TODO el vínculo, incluido el
-- de los seeds — normalmente no hace falta):
-- update public.resident_stays set reservation_id = null where is_current = true;
-- El paso 2 no tiene rollback automático (no guarda la fecha anterior);
-- "Contrato hasta" se puede corregir a mano desde el panel de Residentes.
--
-- Verificación del paso 2 (solo lectura): debería devolver 0 filas.
-- select rs.id, rs.expected_end_date, ro.period_end_date
-- from public.resident_stays rs
-- join public.renewal_offers ro on ro.reservation_id = rs.reservation_id
-- where rs.is_current = true
--   and ro.status in ('confirmed', 'receipt_issued')
--   and (rs.expected_end_date is null or rs.expected_end_date < ro.period_end_date);

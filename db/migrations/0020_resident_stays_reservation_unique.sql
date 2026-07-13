-- EstuRed — Migración 0020: constraint faltante en resident_stays
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Encontrado escribiendo el test de integración de `extendResidentStayOnRenewal`
-- (Ciclo 33bis): nada impedía que dos filas de `resident_stays` apuntaran
-- a la misma `reservation_id` a la vez — `extendResidentStayOnRenewal`
-- usa `.maybeSingle()` sobre ese lookup, que asume unicidad implícita.
-- Con dos filas activas para la misma reserva, la función queda ambigua
-- y no hace nada (comportamiento defensivo correcto, pero silencioso) en
-- vez de que la base impida el estado inconsistente desde el vamos.

create unique index resident_stays_reservation_current_unique
  on public.resident_stays (reservation_id)
  where is_current = true and reservation_id is not null;

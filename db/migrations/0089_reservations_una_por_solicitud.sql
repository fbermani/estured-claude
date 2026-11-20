-- 0089 — Una sola reserva por solicitud (SEG15-01, auditoría complementaria 2026-11-15).
--
-- «Pago recibido» (lib/reservations/recordResidencePaymentReceived.ts) ahora reclama la solicitud con un update condicional
-- (`residence_payment_pending` → `converted_to_reservation`). Este índice es la segunda barrera, a nivel base: aunque otro camino
-- de código se olvide del reclamo, una solicitud no puede tener dos reservas.
--
-- Parcial: `application_request_id` es nullable (reservas nacidas de una oferta de renovación no tienen solicitud).
-- Antes de aplicarlo en un entorno: select application_request_id, count(*) from reservations
--   where application_request_id is not null group by 1 having count(*) > 1;   -- debe dar 0 filas.

create unique index if not exists reservations_one_per_application_uidx
  on public.reservations (application_request_id)
  where application_request_id is not null;

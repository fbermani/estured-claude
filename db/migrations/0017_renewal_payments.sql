-- EstuRed — Migración 0017: pago a residencia de una renovación
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/12 §13.2 (Fase 2 del módulo de Renovaciones — pago a
-- residencia, fee EstuRed, comprobante), docs/06 §14.2
-- (renewal_offers.external_residence_payment_id, ya agregado en la
-- migración 0016 apuntando hacia esta tabla).
--
-- external_residence_payments (migración 0010) exigía
-- application_request_id NOT NULL — nunca se pensó para renovaciones.
-- Se la extiende con el mismo patrón que estured_fee_payments
-- (migración 0010, columna renewal_offer_id) en vez de crear una tabla
-- paralela: docs/06 §14.2 ya modela `renewal_offers.
-- external_residence_payment_id` apuntando A esta misma tabla, no a
-- una nueva.
--
-- No hace falta tocar el `unique (application_request_id)` existente:
-- en Postgres un UNIQUE constraint no compara valores NULL entre sí,
-- así que múltiples filas de renovación con application_request_id
-- NULL conviven sin conflicto.

alter table public.external_residence_payments
  alter column application_request_id drop not null;

alter table public.external_residence_payments
  add column renewal_offer_id uuid references public.renewal_offers (id);

alter table public.external_residence_payments
  add constraint external_residence_payments_target_check check (
    (application_request_id is not null and renewal_offer_id is null) or
    (application_request_id is null and renewal_offer_id is not null)
  );

create unique index external_residence_payments_renewal_offer_unique
  on public.external_residence_payments (renewal_offer_id) where renewal_offer_id is not null;

create index external_residence_payments_renewal_offer_idx
  on public.external_residence_payments (renewal_offer_id);

-- Trampa de FK bidireccional (MEMORY.md §10/§17/§18/§22/§23) — novena
-- aparición: renewal_offers.external_residence_payment_id ↔
-- external_residence_payments.renewal_offer_id. Cualquier embed nuevo
-- entre estas dos tablas necesita el hint explícito desde el primer
-- intento.

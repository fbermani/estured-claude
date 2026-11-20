-- 0094 — Índices parciales para los filtros de vencimiento de los jobs horarios (revisión de código 2026-11-17).
--
-- Los jobs filtran por `expires_at` / `payment_deadline_at` solo sobre filas en estados abiertos; sin índice hacen Seq Scan sobre todo el
-- histórico. Índices parciales: chicos y solo sobre lo vigente. Idempotente (if not exists). No toca datos. Es optimización: sin efecto
-- funcional. ROLLBACK: drop index de cada uno.

create index if not exists application_requests_expires_open_idx
  on public.application_requests (expires_at)
  where status in ('submitted', 'under_review');

create index if not exists application_requests_payment_deadline_idx
  on public.application_requests (payment_deadline_at)
  where payment_deadline_at is not null;

create index if not exists estured_fee_payments_expires_pending_idx
  on public.estured_fee_payments (expires_at)
  where status in ('pending_payment_method', 'pending_manual_payment', 'pending_auto_charge', 'processing');

create index if not exists estured_fee_payments_renewal_offer_idx
  on public.estured_fee_payments (renewal_offer_id)
  where renewal_offer_id is not null;

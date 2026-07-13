-- EstuRed — Migración 0022: vencimiento de solicitudes de renovación
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Ciclo 34nonies. `renewal_offers` ya tiene `acceptance_deadline_at`
-- (migración 0016) pero `renewal_requests` no tenía ningún plazo — los
-- estados `closed_no_offer`/`expired` del enum existían desde el inicio
-- pero nada los podía alcanzar (sin columna de vencimiento, sin job).
-- Regla confirmada por el dueño: la solicitud del estudiante vence a los
-- 30 días si la residencia no responde.

alter table public.renewal_requests
  add column expires_at timestamptz not null default (now() + interval '30 days');

-- EstuRed — Migración 0015: consentimiento de privacidad en la waitlist
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: GAPS.md "PII sin política de retención ni consentimiento
-- formal" (parcialmente resuelto en el Ciclo 26 con /privacy; este es
-- el checkbox de consentimiento explícito pendiente). Sigue el mismo
-- patrón que docs/10 §17.1bis (consentimiento nombrado con timestamp,
-- no solo un booleano) para poder demostrar cuándo se dio.

alter table public.waitlist_signups
  add column if not exists privacy_consent_at timestamptz;

comment on column public.waitlist_signups.privacy_consent_at is
  'Timestamp de cuándo el usuario aceptó la política de privacidad al enviar el formulario. Null solo en filas anteriores a este consentimiento explícito (Ciclo 27).';

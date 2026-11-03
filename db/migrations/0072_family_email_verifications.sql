-- EstuRed — Migración 0072: verificación del mail del familiar (DR32, addendum de seguridad)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE; no modifica filas existentes. Necesita: `users`.
--    Hasta que se aplique, el estudiante NO puede aprobar nuevos vínculos familiares (falla cerrado con un mensaje claro).
--
-- MOTIVO. docs/00 DR32: el familiar se registraba con el mail sin verificar. Un código de 6 dígitos enviado a ese mail prueba que quien
-- registra controla el mail (no que sea adulto: eso queda como responsabilidad declarada, docs/10 §9.6). El estudiante solo puede
-- aprobar un vínculo si el mail del familiar está verificado.
--
-- QUÉ HACE: tabla `family_email_verifications` (una fila por cuenta de familiar: hash del código, vencimiento, intentos, verified_at).
--           RLS habilitada SIN policies: solo el service role lee y escribe.
--
-- REVERTIR:
--   drop table if exists public.family_email_verifications;

begin;

create table if not exists public.family_email_verifications (
  user_id uuid primary key references public.users (id) on delete cascade,
  code_hash text,
  expires_at timestamptz,
  attempts int not null default 0,
  sent_at timestamptz,
  verified_at timestamptz
);

alter table public.family_email_verifications enable row level security;
-- Sin policies a propósito: solo el service role accede.

commit;

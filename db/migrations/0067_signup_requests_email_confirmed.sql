-- 0067: agrega email_confirmed_at a residence_signup_requests (DR22 E3).
-- El admin confirma el email con la residencia durante el contacto; sin esto no se genera la invitación.
-- Idempotente: es seguro correrla aunque 0066 ya incluya la columna.

alter table public.residence_signup_requests
  add column if not exists email_confirmed_at timestamptz;

-- Verificación:
-- select column_name from information_schema.columns
--  where table_name = 'residence_signup_requests' and column_name = 'email_confirmed_at';

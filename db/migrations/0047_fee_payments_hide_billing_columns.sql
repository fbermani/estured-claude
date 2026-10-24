-- EstuRed — Migración 0047: ocultar por API los datos de facturación del pagador en `estured_fee_payments` (auditoría de seguridad)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado).
--    NO está aplicada. Es IDEMPOTENTE (revoke/grant se pueden correr dos veces) y no toca datos.
--
-- MOTIVO. La policy `estured_fee_payments_select_related` (0010) deja leer la FILA ENTERA a: el estudiante beneficiario, el familiar
-- con vínculo activo y CUALQUIER `residence_users` activo (owner/staff) de la residencia de la reserva, con la anon key + su JWT.
-- RLS no filtra columnas, así que `payer_billing_name`, `payer_billing_cuit` y `payer_iva_condition` (agregadas en 0011; CUIT/DNI del
-- padre/madre/pagador) quedaban legibles por la residencia y por terceros vía PostgREST. Solo el service role (pantalla del fee,
-- admin de pagos, emisión de comprobante/factura) debe leerlas. Mismo patrón que 0045 sobre `family_members`.
--
-- QUÉ HACE: revoca el SELECT de tabla a `anon` y `authenticated` y concede SELECT por columnas a `authenticated` sobre todas las
-- columnas actuales EXCEPTO las 3 de facturación. `anon` no recibe nada (la policy ya era `to authenticated`). El service role
-- conserva todo (no se toca). INSERT/UPDATE/DELETE no se tocan: no hay policies de escritura, así que ya estaban bloqueados por RLS.
--
-- COLUMNAS DERIVADAS (leídas en orden de todas las migraciones que tocan la tabla; no hay add/drop/rename en 0016, 0017, 0036, 0040,
-- 0041, 0045 ni 0046: 0016 solo agrega la FK `estured_fee_payments_renewal_offer_fk` sobre una columna ya existente, 0036 solo
-- limpia jsonb de otras tablas, 0040/0041/0045 no alteran esta tabla y 0046 solo menciona la tabla en su comentario):
--   0010 (create table, 33 columnas): id, reservation_id, renewal_offer_id, payer_user_id, beneficiary_student_profile_id, status,
--        fee_rate_percent, fee_base_usd, fee_base_ars, fee_amount_ars, fee_amount_usd, payment_currency, payment_provider,
--        provider_payment_id, provider_payload, idempotency_key, manual_payment_file_id, attempt_count, first_attempt_at,
--        last_attempt_at, paid_at, expires_at, refunded_at, refund_reason, fiscal_invoice_status, fiscal_invoice_id,
--        fiscal_invoice_number, fiscal_invoice_issued_at, fiscal_invoice_file_id, fiscal_invoice_retry_count,
--        fiscal_invoice_last_error, created_at, updated_at
--   0011 (alter table add column, 4 columnas): payer_billing_name*, payer_billing_cuit*, payer_iva_condition*, payment_channel
--   (* = las 3 columnas de facturación que quedan SIN grant)
--   Total: 37 columnas; el grant cubre 31 (sin las 3 de facturación ni provider_payload, idempotency_key y fiscal_invoice_last_error).
--   Si en el futuro se agrega una columna a esta tabla, hay que concederla explícitamente (`grant select (nueva) ... to authenticated`)
--   o no será legible con el cliente del usuario; el service role la ve siempre.
--
-- VERIFICADO CON GREP (código al 2026-10-24): ninguna lectura con el cliente del USUARIO (`getSupabaseServer`) pide esas 3 columnas
-- ni usa `select *` sobre esta tabla. Lecturas con cliente de sesión, todas con columnas concedidas:
--   app/students/applications/[id]/page.tsx (status, fee_amount_ars, paid_at, payer_user_id), app/students/revocation/page.tsx
--   (embed: id, status, paid_at), app/students/renewals/[id]/page.tsx (embed: status), lib/applications/loadReservationInfo.ts
--   (id, status, expires_at; lo llaman dashboards del estudiante y de la residencia/admin con el cliente de sesión).
-- Con service role (no afectadas): app/students/applications/[id]/fee/{page,actions}.tsx (incluye select("*") y escrituras), admin de
-- pagos y dashboard, lib/reservations/*, lib/renewals/*, lib/family/*, lib/support/*, lib/jobs/*, loadFeeInstructionsForPayer.
-- Ojo: tras este revoke, cualquier `select=*` (o `select("*")`) sobre esta tabla con el cliente del usuario da "permission denied".
--
-- REVERTIR: grant select on public.estured_fee_payments to authenticated;   (deja la policy de la 0010 como estaba, con la fuga)

begin;

revoke select on public.estured_fee_payments from anon, authenticated;

-- Ciclo 62: tampoco se concede provider_payload, idempotency_key ni fiscal_invoice_last_error (datos internos;
-- ninguna pantalla con sesión de usuario los lee, solo el service role).
grant select (
  id,
  reservation_id,
  renewal_offer_id,
  payer_user_id,
  beneficiary_student_profile_id,
  status,
  fee_rate_percent,
  fee_base_usd,
  fee_base_ars,
  fee_amount_ars,
  fee_amount_usd,
  payment_currency,
  payment_provider,
  provider_payment_id,
  manual_payment_file_id,
  attempt_count,
  first_attempt_at,
  last_attempt_at,
  paid_at,
  expires_at,
  refunded_at,
  refund_reason,
  fiscal_invoice_status,
  fiscal_invoice_id,
  fiscal_invoice_number,
  fiscal_invoice_issued_at,
  fiscal_invoice_file_id,
  fiscal_invoice_retry_count,
  created_at,
  updated_at,
  payment_channel
) on public.estured_fee_payments to authenticated;

commit;

-- VERIFICACIÓN (SQL Editor, como postgres). Debe devolver exactamente 34 filas, ninguna con billing/iva, y 0 filas en la segunda query:
--   select column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'estured_fee_payments' and grantee = 'authenticated' and privilege_type = 'SELECT'
--   order by column_name;
--
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'estured_fee_payments'
--     and column_name not in (
--       select column_name from information_schema.column_privileges
--       where table_schema = 'public' and table_name = 'estured_fee_payments' and grantee = 'authenticated' and privilege_type = 'SELECT')
--   order by column_name;   -- esperado: payer_billing_cuit, payer_billing_name, payer_iva_condition (y nada más)
--
-- VERIFICACIÓN por API (con el JWT de un estudiante o de staff de la residencia):
--   GET /rest/v1/estured_fee_payments?select=payer_billing_cuit   → 401/403 "permission denied for table estured_fee_payments"
--   GET /rest/v1/estured_fee_payments?select=*                    → idem
--   GET /rest/v1/estured_fee_payments?select=id,status,expires_at → 200 con las filas que la policy permite

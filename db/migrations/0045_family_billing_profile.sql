-- EstuRed — Migración 0045: perfil del familiar con datos de facturación del pagador (Ciclo 61, decisión DR4)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado).
--    NO está aplicada. Es ADITIVA e IDEMPOTENTE (se puede correr dos veces).
--
-- MOTIVO. DR4 (docs/00 §31; docs/06 §6.3): el familiar vinculado tiene perfil propio editable en /students/profile:
-- nombre, teléfono, relación con el estudiante (padre, madre, tutor, otro) y datos de facturación del pagador
-- (CUIT/DNI y condición de IVA), guardados para el fee EstuRed y precargados en la pantalla de pago.
--
-- QUÉ HACE
--   1. `family_members.billing_tax_id` (text null): CUIT (11 dígitos) o DNI (7-8 dígitos), solo dígitos. La validación
--      fina (dígito verificador del CUIT) es server-side; acá solo un CHECK de formato como red de seguridad.
--   2. `family_members.billing_vat_condition` (text null): consumidor_final, responsable_inscripto, monotributista, exento
--      (mismos valores que `estured_fee_payments.payer_iva_condition`).
--   3. `relationship_type` admite `otro` (docs/06 §6.3). El valor previo `familiar` se conserva como válido y equivale a
--      `otro` (la UI lo normaliza al leer): así el registro actual sigue funcionando aunque el código se despliegue
--      antes o después de esta migración.
--   4. Escritura: `family_members` queda SOLO LECTURA para anon/authenticated (hoy ya no hay policies de INSERT/UPDATE/DELETE;
--      se revocan los privilegios por defensa en profundidad). El perfil se edita únicamente por server action con
--      service role y validación server-side (`saveFamilyProfile`).
--   5. Lectura por COLUMNAS (auditoría de seguridad, Ciclo 61): la policy `family_members_select_linked_student` (0005/0006)
--      deja al estudiante vinculado leer la FILA del familiar por la API; RLS no filtra columnas, así que se revoca el SELECT
--      de tabla a `authenticated` y se concede solo sobre columnas NO sensibles (sin `identity_document_number`, `phone`,
--      `billing_tax_id` ni `billing_vat_condition`). Verificado con grep: ninguna pantalla lee esas columnas con el cliente del
--      usuario; la lectura propia del perfil (`/students/profile`), el teléfono de contacto y la facturación del fee van por
--      service role (`getSupabaseAdmin`) con filtro explícito por la sesión. Los datos de facturación nunca los ve la residencia.
--
-- REVERTIR: grant select on public.family_members to authenticated; alter table public.family_members drop column billing_tax_id, drop column billing_vat_condition;
--           y volver a crear el CHECK de relationship_type sin 'otro' (solo si no hay filas con 'otro').

begin;

alter table public.family_members add column if not exists billing_tax_id text;
alter table public.family_members add column if not exists billing_vat_condition text;

alter table public.family_members drop constraint if exists family_members_billing_tax_id_check;
alter table public.family_members
  add constraint family_members_billing_tax_id_check
  check (billing_tax_id is null or billing_tax_id ~ '^[0-9]{7,8}$' or billing_tax_id ~ '^[0-9]{11}$');

alter table public.family_members drop constraint if exists family_members_billing_vat_condition_check;
alter table public.family_members
  add constraint family_members_billing_vat_condition_check
  check (
    billing_vat_condition is null
    or billing_vat_condition in ('consumidor_final', 'responsable_inscripto', 'monotributista', 'exento')
  );

alter table public.family_members drop constraint if exists family_members_relationship_type_check;
alter table public.family_members
  add constraint family_members_relationship_type_check
  check (relationship_type in ('padre', 'madre', 'tutor', 'otro', 'familiar'));

-- Solo lectura desde la API (las escrituras van por service role) y solo columnas no sensibles.
revoke insert, update, delete on public.family_members from anon, authenticated;
revoke select on public.family_members from anon, authenticated;
grant select (id, user_id, first_name, last_name, relationship_type, created_at, updated_at) on public.family_members to authenticated;

comment on column public.family_members.billing_tax_id is 'CUIT (11 dígitos) o DNI (7-8) del pagador para la Factura C del fee (DR4). Privado.';
comment on column public.family_members.billing_vat_condition is 'Condición de IVA del pagador para la Factura C del fee (DR4). Privado.';

-- VERIFICACIÓN (como `authenticated`, p. ej. con el JWT de un estudiante vinculado): esto debe dar "permission denied for table/column":
--   select billing_tax_id from public.family_members;   select phone from public.family_members;
-- y esto debe seguir funcionando:  select id, first_name, last_name, relationship_type from public.family_members;

commit;

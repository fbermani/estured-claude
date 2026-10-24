-- EstuRed — Migración 0046: el acceso del familiar a los datos del estudiante exige vínculo ACTIVO (Ciclo 61, auditoría de seguridad)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ES MÁS URGENTE QUE LA 0045 (cierra una fuga de datos). Orden sugerido: 0046 y después 0045 (son independientes).
--    Es IDEMPOTENTE (`create or replace`) y no cambia firmas, así que no hace falta tocar las policies que usan las funciones.
--
-- PROBLEMA (hallazgo CRÍTICO, viene desde la 0006). `is_family_member_of_student(profile_id)` no filtraba `family_links.status`:
-- un familiar con vínculo `pending_student_approval`, `rejected_by_student`, `revoked_by_student`, `revoked_by_family` o
-- `suspended_minor_no_family` seguía pasando todas las policies de SELECT que la usan y podía leer por PostgREST (anon key +
-- su JWT) `student_profiles` (PII de menores), `application_requests`, `application_snapshots`, `reservations`,
-- `external_residence_payments`, `estured_fee_payments`, `booking_receipts`, renovaciones, `waitlist_entries`,
-- `resident_stays`, `student_favorites` y las propuestas de ajuste (0007, 0008, 0010, 0011, 0016, 0018, 0019, 0033).
--
-- ARREGLO.
--   1. `is_family_member_of_student`: agrega `and status = 'active'` (solo el vínculo activo da acceso a los datos del estudiante).
--   2. `is_student_linked_to_family_member` (lado inverso: el ESTUDIANTE lee la fila del familiar): ahora cubre
--      `active` y `pending_student_approval`. El estudiante necesita ver el nombre de quien le pidió vincularse para APROBAR o
--      RECHAZAR (dashboard y perfil); un vínculo rechazado o revocado ya no le expone al familiar. Con la 0045 la lectura de
--      esa fila queda además limitada a columnas no sensibles.
--   3. Misma definición `security definer` + `set search_path = public` + `stable` y mismas firmas: ninguna policy cambia.
--   4. Aprobación del vínculo: no depende de estas funciones. `family_links_select_related` (0004) deja al estudiante y al
--      familiar leer SUS filas de `family_links` sin importar el estado, y las aprobaciones/rechazos se escriben por service role.
--   5. Efecto en la app (ya ajustado en el código del Ciclo 61): el familiar con vínculo pendiente deja de leer
--      `student_profiles` por la API, así que su dashboard obtiene el nombre del estudiante por service role con filtro por sus
--      propios vínculos.
--
-- REVERTIR: volver a las definiciones de la 0006 (sin filtro de estado). No recomendado: reabre el hallazgo.

begin;

create or replace function public.is_family_member_of_student(profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_links
    where student_profile_id = profile_id
      and status = 'active'
      and family_member_id in (
        select id from public.family_members where user_id = auth.uid()
      )
  );
$$;

create or replace function public.is_student_linked_to_family_member(fm_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.family_links
    where family_member_id = fm_id
      and status in ('active', 'pending_student_approval')
      and student_profile_id in (
        select id from public.student_profiles where user_id = auth.uid()
      )
  );
$$;

-- VERIFICACIÓN (las dos deben devolver 0 filas): con el JWT de un familiar cuyo vínculo NO está activo,
--   select id from public.student_profiles;            -- nada del estudiante
--   select id from public.application_requests;        -- nada del estudiante
-- y con el JWT de un familiar con vínculo activo siguen apareciendo los datos de su estudiante.
-- Comprobación de definición:
--   select proname, prosrc from pg_proc where proname in ('is_family_member_of_student','is_student_linked_to_family_member');

commit;

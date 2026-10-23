-- EstuRed — Migración 0043b: quitar las columnas sensibles de `residences` (Ciclo 56) — FASE B de 2
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ EJECUTAR DESPUÉS DE DEPLOYAR EL CÓDIGO DEL CICLO 56 (y después de 0043). NO antes: el código viejo todavía
--   lee `residences.responsible_*`, etc. y se rompería. Aplicar primero en estured-dev y
--   después en producción (por separado).
--
-- Con esta migración deja de ser legible con la anon key el contacto del responsable, la señal de
-- calidad y la auditoría interna del acceso a Gestión Operativa (hallazgo de seguridad del Ciclo 55).
--
-- PASOS
--   1. Re-sincronización por si entre 0043 y el deploy el código viejo escribió en `residences` (p. ej. un admin
--      cambió el acceso a GO). NUNCA pisa un valor ya presente en la tabla privada.
--      `quality_visibility_status` NO se re-sincroniza a propósito: es NOT NULL con default, así que no hay forma
--      de distinguir "sin cargar" de una decisión legítima del admin hecha en la tabla privada entre el deploy y
--      esta migración; se conserva el valor del backfill de 0043 (o el que haya guardado el código nuevo).
--   2. DROP de las columnas de `residences`.
--   3. `profile_availability.notes_internal` (nota interna de disponibilidad, docs/06 §9.4): la policy pública
--      `availability_select_public` expone la fila completa a anon, así que se restringe por COLUMNA: se revoca
--      el SELECT de tabla a anon/authenticated y se concede solo sobre las columnas públicas. La columna no se
--      toca (el service role sigue leyéndola/escribiéndola; hoy el código no la usa).
--      ⚠ Consecuencia: toda columna NUEVA de `profile_availability` que deba leerse con un cliente RLS necesita su
--      propio `grant select (col) on public.profile_availability to anon, authenticated;` (falla ruidosa con
--      42501, no silenciosa). `select=*` desde anon/authenticated sobre esta tabla pasa a devolver error.
--
-- REVERTIR: recrear las columnas (tipos en 0003/0030/0031) y copiar desde `residence_private_details`;
--   `grant select on public.profile_availability to anon, authenticated;`.

-- 1) Re-sync defensivo (solo rellena lo que está vacío en la tabla privada).
update public.residence_private_details p
set
  responsible_name = coalesce(p.responsible_name, r.responsible_name),
  responsible_contact = coalesce(p.responsible_contact, r.responsible_contact),
  operational_access_granted_by = coalesce(p.operational_access_granted_by, r.operational_access_granted_by),
  operational_access_granted_at = coalesce(p.operational_access_granted_at, r.operational_access_granted_at),
  operational_access_reason = coalesce(p.operational_access_reason, r.operational_access_reason),
  om_access_granted_by = coalesce(p.om_access_granted_by, r.om_access_granted_by),
  om_access_granted_at = coalesce(p.om_access_granted_at, r.om_access_granted_at)
from public.residences r
where r.id = p.residence_id;

-- 2) Quitar las columnas sensibles de la tabla legible con la anon key.
alter table public.residences
  drop column if exists responsible_name,
  drop column if exists responsible_contact,
  drop column if exists quality_visibility_status,
  drop column if exists operational_access_granted_by,
  drop column if exists operational_access_granted_at,
  drop column if exists operational_access_reason,
  drop column if exists om_access_granted_by,
  drop column if exists om_access_granted_at;

-- 3) profile_availability: ocultar `notes_internal` (y solo esa) a anon/authenticated.
revoke select on public.profile_availability from anon, authenticated;
grant select (
  id, residence_id, room_type_id, status, available_count, available_from,
  last_confirmed_by, last_confirmed_at, expires_at, hidden_from_search_at,
  notes_public, created_at, updated_at
) on public.profile_availability to anon, authenticated;

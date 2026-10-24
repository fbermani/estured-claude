-- EstuRed — Migración 0048: mensaje de "pedir cambios" para la residencia + ocultar por API `notes_internal` de la verificación (Ciclo 66, DR5)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). Orden pendiente: 0046, 0045, 0047, 0048.
--    NO está aplicada. Es IDEMPOTENTE (add column if not exists, revoke/grant se pueden correr dos veces) y no toca datos existentes.
--
-- MOTIVO (1/2). Cuando el admin pide cambios a una residencia (`needs_changes`), el motivo hoy solo vive en `notes_internal` (campo
-- interno) y la residencia no se entera. DR5 (docs/00 §31, opción A): el admin escribe un "Mensaje para la residencia", separado de las
-- notas internas, que la residencia ve en su Panel y en /profile antes de corregir y reenviar. Se agregan:
--   - changes_requested_message  text, nullable, CHECK largo <= 1000 (el mínimo de 10 caracteres lo valida la server action).
--   - changes_requested_at       timestamptz, nullable (auditar cuándo se pidieron los cambios).
-- Las escribe y lee SOLO el service role (server actions / server components). Al reenviar la residencia, la acción limpia el mensaje de
-- la fila y lo deja en el audit log (`reason_text` / `old_value`).
--
-- MOTIVO (2/2). La policy `residence_verifications_select_own` (0003) deja leer la FILA ENTERA a cualquier `residence_users` activo
-- (owner/staff) de la residencia con la anon key + su JWT. RLS no filtra columnas, así que `notes_internal` (nota interna del admin con el
-- motivo real de la revisión, incluso rechazos) era legible por la residencia vía PostgREST. Ahora que existe un canal oficial para
-- comunicar cambios (el mensaje de arriba), `notes_internal` debe quedar solo para el service role. Mismo patrón que 0043b/0045/0047.
--
-- QUÉ HACE: agrega las dos columnas; revoca el SELECT de tabla a `anon` y `authenticated` y concede SELECT por columnas a `authenticated`
-- sobre las 15 columnas de la 0003 que quedan, EXCEPTO `notes_internal` (son 16 en total); las dos columnas nuevas tampoco se conceden (solo service role). `anon` no
-- recibe nada (la policy ya era `to authenticated`). INSERT/UPDATE/DELETE no se tocan: no hay policies de escritura.
--
-- COLUMNAS DERIVADAS (0003 es la única migración que define/altera la tabla; el resto solo la menciona): id, residence_id, status,
-- scheduled_at, visited_at, verified_by_user_id, responsible_identity_checked, coordinator_identity_checked, address_checked,
-- photos_match_reality, signed_checklist_file_id, notes_internal*, approved_at, expires_at, created_at, updated_at (* sin grant).
-- Si en el futuro se agrega una columna a esta tabla hay que concederla explícitamente (`grant select (nueva) ... to authenticated`)
-- o no será legible con el cliente del usuario; el service role la ve siempre.
--
-- VERIFICADO CON GREP (código al 2026-10-24): NINGÚN código con el cliente del USUARIO (`getSupabaseServer`) ni del navegador lee
-- `residence_verifications` (ni `notes_internal` ni `select *`). Todos los lectores usan el service role: app/admin/verifications/{page,actions},
-- app/admin/residences/[id]/page, app/residence/[residence_id]/{page,profile/actions}, app/(public)/register/residence/actions,
-- lib/residences/addResidenceForOwner, lib/jobs/expireResidenceVerifications y scripts/seed-demo-data.mjs. Por eso el revoke es seguro.
-- Ojo: tras este revoke, cualquier `select=*` sobre esta tabla con el cliente del usuario da "permission denied".
--
-- REVERTIR:
--   grant select on public.residence_verifications to authenticated;   (vuelve a exponer notes_internal a owner/staff)
--   alter table public.residence_verifications drop column if exists changes_requested_message, drop column if exists changes_requested_at;

begin;

alter table public.residence_verifications
  add column if not exists changes_requested_message text
    check (changes_requested_message is null or char_length(changes_requested_message) <= 1000),
  add column if not exists changes_requested_at timestamptz;

revoke select on public.residence_verifications from anon, authenticated;

grant select (
  id,
  residence_id,
  status,
  scheduled_at,
  visited_at,
  verified_by_user_id,
  responsible_identity_checked,
  coordinator_identity_checked,
  address_checked,
  photos_match_reality,
  signed_checklist_file_id,
  approved_at,
  expires_at,
  created_at,
  updated_at
) on public.residence_verifications to authenticated;

commit;

-- Verificación (descomentar y correr aparte):
-- select column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'residence_verifications' and grantee = 'authenticated' and privilege_type = 'SELECT'
--   order by column_name;                       -- 15 columnas; sin notes_internal ni changes_requested_*
-- select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'residence_verifications' and column_name like 'changes_requested%';

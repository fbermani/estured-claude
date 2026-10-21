-- EstuRed — Migración 0037: cierre del UPDATE directo sobre el perfil del estudiante (H04, seguridad ALTA)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción.
--
-- MOTIVO. La migración 0002 creó dos policies de UPDATE para `authenticated` sin restricción de columnas:
--   - `student_profiles_update_own`  → el estudiante podía cambiar CUALQUIER columna de su perfil
--     (`is_minor`, `birth_date`, `profile_completed_at`, ...) con la anon key + su JWT, vía PostgREST.
--   - `visibility_update_own`        → podía prender `is_individual_profile_visible` y todos los `show_*`
--     (además, esta policy no tenía `with check`).
--   Así un menor se ponía `is_minor = false` o se hacía visible en la comunidad salteando
--   `updateCommunityVisibility` (regla de menores de docs/10 §9.2 y consentimiento versionado).
--
-- SUPUESTO VERIFICADO (Ciclo 49): ninguna escritura de la app sobre `student_profiles` ni
-- `student_visibility_settings` usa el cliente con JWT del usuario. Todas van por service role
-- (`getSupabaseAdmin()`): registro (`app/(public)/register/student/actions.ts`), perfil y visibilidad
-- (`app/students/profile/actions.ts`) y los scripts de seed. El service role ignora RLS, así que quitar
-- estas policies no rompe nada. Las policies de SELECT quedan como están.
-- No hay otras policies de INSERT/UPDATE/DELETE en `student_profiles`, `student_visibility_settings`,
-- `consents`, `family_links`, `family_members` ni `family_invitations` (todas son solo SELECT).
--
-- PASO 1 — ESQUEMA: dropea las dos policies (idempotente).
-- PASO 2 — DATOS: oculta en la comunidad a (a) todo menor y (b) los adultos que quedaron visibles por el
--   forzado previo a H04 (Ciclo 37: guardar el perfil ponía `is_individual_profile_visible = true` y grababa
--   un consent `student_visibility` con `metadata = {is_individual_profile_visible: true}`, SIN `source`).
--   Desde H04 el flujo nuevo graba `metadata.source` ('registration' o 'profile'): esa es la marca de un
--   opt-in consciente. Cada fila cambiada deja un `audit_logs` con el valor anterior.
--
-- ROLLBACK:
--   Paso 1: volver a crear las policies con el cuerpo de la 0002 (NO recomendado: reabre el hallazgo).
--   Paso 2: no hay rollback automático de datos. El valor anterior de cada fila queda en
--     `audit_logs.old_value` (reason_code 'h04_minor_reset' / 'h04_legacy_forced_reset'), por si hubiera
--     que reconstruir algún caso puntual a mano. Lo correcto es que el estudiante adulto vuelva a activar
--     su perfil desde /students/profile (eso graba el consentimiento nuevo).

begin;

-- ==== PASO 1 — ESQUEMA: sin UPDATE directo desde la API ====
drop policy if exists student_profiles_update_own on public.student_profiles;
drop policy if exists visibility_update_own on public.student_visibility_settings;

-- Mismo agujero en `users` (hallado por base-datos al auditar H04): `users_update_own`
-- (migración 0002) deja que un usuario edite su propia fila por la API; su `with check`
-- solo exige `is_blocked = false` DESPUÉS del cambio, así que un usuario bloqueado podía
-- desbloquearse solo, y cualquiera podía alterar `email`, `primary_role` (falsea `actor_role`
-- en la auditoría), `is_active` o `blocked_reason`. Verificado con grep: la app solo escribe
-- `users` con el cliente de servicio (registro, setUserBlockedStatus, seeds, create-admin).
drop policy if exists users_update_own on public.users;

-- ==== PASO 2 — DATOS (idempotente: re-correrlo no cambia filas ni duplica auditoría) ====

-- (2a) TODO menor: maestro y todos los `show_*` en false.
--      Menor = `is_minor = true` O `birth_date` de hace menos de 18 años (mismo criterio que
--      `isMinorByBirthDate` en lib/residents/communityVisibility.ts; cubre un `is_minor` ya adulterado
--      vía la policy vieja). Se aplica también a cuentas demo: la única demo menor (Valentina) ya es
--      privada en el seed y los residentes demo nacieron entre 2001 y 2007 → no los afecta.
with target as (
  select v.student_profile_id,
         to_jsonb(v) - 'id' - 'student_profile_id' - 'updated_at' as old_value
  from public.student_visibility_settings v
  join public.student_profiles sp on sp.id = v.student_profile_id
  where (sp.is_minor = true or sp.birth_date > current_date - interval '18 years')
    and (v.is_individual_profile_visible or v.show_photo_to_guests or v.show_photo_to_registered
         or v.show_age_to_registered or v.show_nationality_to_registered or v.show_career_to_registered
         or v.show_origin_city_to_registered or v.show_habits_to_registered or v.show_interests_to_registered)
), upd as (
  update public.student_visibility_settings v
  set is_individual_profile_visible = false,
      show_photo_to_guests = false,
      show_photo_to_registered = false,
      show_age_to_registered = false,
      show_nationality_to_registered = false,
      show_career_to_registered = false,
      show_origin_city_to_registered = false,
      show_habits_to_registered = false,
      show_interests_to_registered = false
  from target t
  where v.student_profile_id = t.student_profile_id
  returning v.student_profile_id, to_jsonb(v) - 'id' - 'student_profile_id' - 'updated_at' as new_value
)
insert into public.audit_logs
  (actor_user_id, actor_role, action, entity_type, entity_id, old_value, new_value,
   reason_code, reason_text, is_system_action, source)
select null, 'system', 'student_visibility_updated', 'student_visibility_settings', u.student_profile_id,
       t.old_value, u.new_value, 'h04_minor_reset',
       'Migración 0037: un menor nunca muestra perfil individual (docs/10 §9.2).', true, 'system'
from upd u join target t using (student_profile_id);

-- (2b) Adultos visibles SIN opt-in consciente: maestro en false (los `show_*` no se tocan; con el maestro
--      apagado no se muestra nada, y el estudiante los ve tal cual si vuelve a activarlo).
--      "Sin opt-in consciente" = no existe ningún consent `student_visibility` con `metadata.source`
--      (cubre el forzado del Ciclo 37 y cualquier visibilidad prendida a mano vía la policy vieja).
--      EXCLUYE el dataset demo: emails `@example.com` / `@estured.test` (dominios reservados, ninguna
--      cuenta real puede tenerlos) → los residentes de `fix-resident-visibility.mjs` siguen visibles.
with target as (
  select v.student_profile_id,
         to_jsonb(v) - 'id' - 'student_profile_id' - 'updated_at' as old_value
  from public.student_visibility_settings v
  join public.student_profiles sp on sp.id = v.student_profile_id
  join public.users u on u.id = sp.user_id
  where v.is_individual_profile_visible = true
    and lower(u.email) not like '%@example.com'
    and lower(u.email) not like '%@estured.test'
    and not exists (
      select 1 from public.consents c
      where c.user_id = sp.user_id
        and c.consent_type = 'student_visibility'
        and jsonb_exists(c.metadata, 'source')
    )
), upd as (
  update public.student_visibility_settings v
  set is_individual_profile_visible = false
  from target t
  where v.student_profile_id = t.student_profile_id
  returning v.student_profile_id, to_jsonb(v) - 'id' - 'student_profile_id' - 'updated_at' as new_value
)
insert into public.audit_logs
  (actor_user_id, actor_role, action, entity_type, entity_id, old_value, new_value,
   reason_code, reason_text, is_system_action, source)
select null, 'system', 'student_visibility_updated', 'student_visibility_settings', u.student_profile_id,
       t.old_value, u.new_value, 'h04_legacy_forced_reset',
       'Migración 0037: visibilidad forzada antes de H04, sin consentimiento explícito.', true, 'system'
from upd u join target t using (student_profile_id);

commit;

-- ==== Verificación (descomentar y correr después de aplicar) ====
-- 1) Policies de UPDATE eliminadas → 0 filas:
-- select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and tablename in ('student_profiles', 'student_visibility_settings')
--     and cmd <> 'SELECT';
--
-- 2) Ningún menor con algo visible → 0:
-- select count(*) as menores_visibles
-- from public.student_visibility_settings v
-- join public.student_profiles sp on sp.id = v.student_profile_id
-- where (sp.is_minor or sp.birth_date > current_date - interval '18 years')
--   and (v.is_individual_profile_visible or v.show_photo_to_guests or v.show_photo_to_registered
--        or v.show_age_to_registered or v.show_nationality_to_registered or v.show_career_to_registered
--        or v.show_origin_city_to_registered or v.show_habits_to_registered or v.show_interests_to_registered);
--
-- 3) Ningún adulto real visible sin opt-in del flujo nuevo → 0:
-- select count(*) as visibles_sin_optin
-- from public.student_visibility_settings v
-- join public.student_profiles sp on sp.id = v.student_profile_id
-- join public.users u on u.id = sp.user_id
-- where v.is_individual_profile_visible
--   and lower(u.email) not like '%@example.com' and lower(u.email) not like '%@estured.test'
--   and not exists (select 1 from public.consents c where c.user_id = sp.user_id
--                   and c.consent_type = 'student_visibility' and jsonb_exists(c.metadata, 'source'));
--
-- 4) Dataset demo intacto (en dev debe seguir > 0; en producción, 0 es normal):
-- select count(*) as demo_visibles
-- from public.student_visibility_settings v
-- join public.student_profiles sp on sp.id = v.student_profile_id
-- join public.users u on u.id = sp.user_id
-- where v.is_individual_profile_visible
--   and (lower(u.email) like '%@example.com' or lower(u.email) like '%@estured.test');
--
-- 5) Qué cambió (auditoría de esta migración):
-- select reason_code, count(*) from public.audit_logs
--   where reason_code in ('h04_minor_reset', 'h04_legacy_forced_reset') group by reason_code;
--
-- 6) Prueba negativa opcional (desde la app o con curl usando anon key + JWT de un estudiante):
--    PATCH /rest/v1/student_profiles?user_id=eq.<uid> {"is_minor": false} → debe afectar 0 filas.

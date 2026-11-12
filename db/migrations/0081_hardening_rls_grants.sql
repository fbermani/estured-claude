-- EstuRed — Migración 0081: endurecimiento de RLS y grants (auditoría de seguridad 2026-11-11: A1, A2, M7, B9, B10, B11, I2)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Es IDEMPOTENTE (drop policy if exists / create or replace / revoke+grant se pueden correr dos veces) y no toca datos.
--    Necesita 0001–0080 aplicadas (usa tablas de 0055, 0068, 0071, 0075 y 0076).
--
-- Fuente: docs/audits/SEGURIDAD_2026-11-11.md (A1, A2, M7, B9, B10, B11, I2) y docs/audits/PLAN_SEGURIDAD_2026-11-12.md.
--
-- QUÉ HACE
--   1. A1 — usuario bloqueado/inactivo sin acceso por PostgREST.
--      `public.is_active_user()` (security definer, search_path vacío) + una policy RESTRICTIVE `<tabla>_only_active_users`
--      `for all to authenticated` en las 46 tablas de `public` que tienen alguna policy permissive para `authenticated`.
--      Las restrictivas se combinan con AND con las permissive existentes: no las reescriben ni amplían nada.
--      La lista de tablas sale de recorrer 0001–0080 en orden y quedarse con el estado final de policies (las eliminadas en
--      0005/0006/0037 no cuentan; ninguna policy usa el rol `public`, todas declaran `to authenticated` o `to anon, authenticated`).
--      Tablas con RLS y SIN policies (solo service role) no llevan restrictiva: no hay nada que restringir (waitlist_signups,
--      audit_logs, files, application_status_events, rooms, beds, resident_notes, residence_profile_edits, tariff_change_logs,
--      document_access_log, payment_settings, residence_faq_questions, residence_private_details, residence_team_invitations,
--      residence_photo_meta, residence_promotions, resident_stay_invitations, missing_residence_requests,
--      residence_signup_requests, arrival_reminder_sends, family_email_verifications, preapertura_estudiantes,
--      preapertura_invitaciones).
--      `users` SÍ lleva restrictiva: `lib/auth/session.ts:37-49` y `app/(public)/reset-password/actions.ts:61-69` leen
--      `users` con el cliente de sesión, pero ambos tratan "sin fila" igual que "bloqueado/inactivo" (`!appUser || ...` → null /
--      acceso denegado con el mismo mensaje y el mismo audit `account_not_enabled`). La detección de bloqueo no cambia.
--      Efecto colateral aceptado: con su JWT, un bloqueado tampoco ve el catálogo público (residences, room_types, exchange_rates,
--      FAQ…); sin JWT (anon) lo sigue viendo como cualquier visitante. La app lee el catálogo con service role.
--      COMPLEMENTO FUERA DE ESTA MIGRACIÓN (código): ban en Supabase Auth al bloquear (`ban_duration`) para cortar el refresh token.
--      OJO A FUTURO: toda tabla nueva con policy para `authenticated` necesita su restrictiva (la verificación 1 detecta faltantes).
--   2. A2 — notas internas fuera del alcance de `authenticated`/`anon`.
--      `application_negotiation_proposals.internal_notes` y `application_requests.rejection_reason_internal`: revoke del SELECT de
--      tabla + grant por columnas a `authenticated` de todas las demás. Columnas derivadas de 0007/0008 + `add column` posteriores
--      (0012 family_proposal_id; 0044 stay_change_intent_id, move_context_note; 0053 regulation_acceptance_pending; ninguna en
--      negotiation_proposals) y contrastadas con el esquema real de estured-dev (OpenAPI de PostgREST, 2026-11-12):
--      application_requests 29 columnas → 28 concedidas; application_negotiation_proposals 26 → 25 concedidas.
--   3. M7 — la residencia deja de leer casos de Soporte por la API: drop de `support_cases_select_residence` (0023).
--      Se elige el drop y no el grant por columnas porque el grant afectaría también al que abrió el caso
--      (`support_cases_select_opener`, mismo rol `authenticated`) y porque la app ya lee `support_cases` SOLO con service role
--      (app/residence/[residence_id]/support/page.tsx:50, lib/residences/ownerDashboard.ts:108, app/students/*, app/admin/*, lib/*).
--   4. B9 — drop de las policies de escritura directa que la app no usa (escribe con service role:
--      lib/followups/respond.ts:41 y app/students/dashboard/arrivalActions.ts:39):
--      `stay_followup_responses_insert_own` (0055) y `arrival_checklist_items_insert` / `_delete` (0068),
--      + revoke de INSERT (incluye los grants por columna de 0055) y DELETE a `authenticated`. Los SELECT quedan como estaban.
--   5. B10 — `is_family_member_of_student(uuid)` e `is_student_linked_to_family_member(uuid)` (0006/0046): sin EXECUTE para
--      public/anon; solo `authenticated` (todas las policies que las usan son `to authenticated`).
--   6. B11 — `exchange_rates`: anon/authenticated leen solo las columnas no sensibles (sin overridden_by_user_id, override_reason,
--      notes). La app lee esta tabla solo con service role (lib/exchange/rate.ts, app/admin/exchange-rate/*).
--   7. I2 — `users.blocked_reason` (motivo interno, docs/06) no legible por `authenticated`; anon no recibe nada (no tenía policy).
--
-- CÓDIGO VERIFICADO CON GREP (2026-11-12): ninguna lectura con el cliente de sesión (`getSupabaseServer`) hace `select("*")` ni pide
--   las columnas ocultadas en application_requests (app/students/applications/page.tsx:81, [id]/page.tsx:59,125,
--   app/students/dashboard/page.tsx:528: columnas explícitas), application_negotiation_proposals, exchange_rates, support_cases ni
--   users (session.ts y reset-password piden columnas concedidas). Tras esta migración, cualquier `select("*")` sobre esas 4 tablas
--   con el cliente del usuario da "permission denied"; el service role no cambia.
--   Si en el futuro se agrega una columna a application_requests, application_negotiation_proposals, exchange_rates o users, hay
--   que concederla explícitamente (`grant select (nueva) on ... to authenticated`) o no será legible con el cliente del usuario.
--
-- SUPUESTOS REVERSIBLES
--   - Usuario sin fila en `public.users` = no activo (no hay flujo legítimo así: todos los registros insertan la fila).
--   - La residencia no necesita leer `support_cases` por la API (hoy no lo hace; la UI lee con service role y filtra columnas).
--
-- REVERTIR (en este orden):
--   do $$ declare t text; begin foreach t in array array[<lista del bloque 1>] loop
--     execute format('drop policy if exists %I on public.%I', t || '_only_active_users', t); end loop; end $$;
--   drop function if exists public.is_active_user();
--   grant select on public.application_negotiation_proposals, public.application_requests, public.users to authenticated;
--   grant select on public.exchange_rates to anon, authenticated;
--   create policy support_cases_select_residence on public.support_cases for select to authenticated using (
--     residence_id in (select residence_id from public.residence_users where user_id = (select auth.uid()) and is_active = true));
--   (B9) recrear las policies de 0055:158-162 y 0068:93-98 y sus grants (0055:170-171, 0068:102).
--   (B10) grant execute on function public.is_family_member_of_student(uuid), public.is_student_linked_to_family_member(uuid) to anon;

begin;

-- ==== 1. A1: is_active_user() + policies RESTRICTIVE ====
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.is_active and not u.is_blocked
  );
$$;

revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

-- Lista explícita (estado final de policies de 0001–0080; migración de origen entre paréntesis).
do $$
declare
  t text;
begin
  foreach t in array array[
    'application_negotiation_proposals',   -- 0008
    'application_regulation_acceptances',  -- 0053
    'application_requests',                -- 0007
    'application_snapshots',               -- 0007
    'arrival_checklist_items',             -- 0068
    'booking_receipts',                    -- 0011
    'consents',                            -- 0002
    'estured_fee_payments',                -- 0010
    'exchange_rates',                      -- 0009 (anon, authenticated)
    'external_residence_payments',         -- 0010
    'family_application_proposals',        -- 0012
    'family_invitations',                  -- 0034
    'family_links',                        -- 0004
    'family_members',                      -- 0004, 0006
    'guardian_stay_confirmations',         -- 0071
    'notifications',                       -- 0021
    'profile_availability',                -- 0003 (pública + own)
    'profile_availability_genders',        -- 0075 (pública + team)
    'renewal_offers',                      -- 0016
    'renewal_receipts',                    -- 0016
    'renewal_requests',                    -- 0016
    'reservations',                        -- 0010
    'residence_custom_amenities',          -- 0058 (pública + team)
    'residence_faq_items',                 -- 0054 (anon, authenticated)
    'residence_faq_predefined_questions',  -- 0054 (anon, authenticated)
    'residence_profile_sections',          -- 0003 (pública + own)
    'residence_regulation_versions',       -- 0053 (pública + own + accepted)
    'residence_users',                     -- 0003
    'residence_verifications',             -- 0003
    'residences',                          -- 0003 (pública + own)
    'resident_link_requests',              -- 0064
    'resident_stays',                      -- 0019
    'room_change_place_alerts',            -- 0076
    'room_change_requests',                -- 0076
    'room_types',                          -- 0003 (pública + own)
    'stay_change_intents',                 -- 0044
    'stay_early_exits',                    -- 0044
    'stay_followup_responses',             -- 0055
    'stay_followups',                      -- 0055
    'student_favorites',                   -- 0033
    'student_profiles',                    -- 0002, 0006
    'student_visibility_settings',         -- 0002
    'support_cases',                       -- 0023 (queda solo la del que abrió el caso, ver bloque 3)
    'user_roles',                          -- 0002
    'users',                               -- 0002 (ver cabecera: la detección de bloqueo no cambia)
    'waitlist_entries'                     -- 0018
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_only_active_users', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated '
      || 'using ((select public.is_active_user())) with check ((select public.is_active_user()))',
      t || '_only_active_users', t
    );
  end loop;
end
$$;

-- ==== 2. A2: notas internas ====
revoke select on public.application_negotiation_proposals from anon, authenticated;
grant select (
  id,
  application_request_id,
  sent_by_user_id,
  residence_id,
  proposed_monthly_price_usd,
  proposed_monthly_price_ars,
  proposed_enrollment_fee_usd,
  proposed_enrollment_fee_ars,
  proposed_deposit_usd,
  proposed_deposit_ars,
  proposed_room_type_id,
  proposed_place_id,
  proposed_start_date,
  proposed_duration_months,
  proposed_adjustment_policy,
  proposed_reservation_payment_amount_usd,
  special_conditions,
  -- internal_notes: NO (solo service role)
  warning_shown_at,
  warning_accepted_at,
  student_response,
  student_response_at,
  student_response_by_user_id,
  expires_at,
  created_at,
  updated_at
) on public.application_negotiation_proposals to authenticated;

revoke select on public.application_requests from anon, authenticated;
grant select (
  id,
  student_profile_id,
  family_link_id,
  initiated_by,
  contact_target,
  residence_id,
  room_type_id,
  place_id,
  status,
  desired_start_date,
  initial_duration_months,
  academic_objective,
  snapshot_original_id,
  snapshot_final_id,
  proposal_count,
  active_request_group_id,
  contact_established_at,
  payment_deadline_at,
  rejection_reason_code,
  -- rejection_reason_internal: NO (solo service role)
  cancelled_reason,
  expires_at,
  created_by_user_id,
  created_at,
  updated_at,
  family_proposal_id,             -- 0012
  stay_change_intent_id,          -- 0044
  move_context_note,              -- 0044
  regulation_acceptance_pending   -- 0053
) on public.application_requests to authenticated;

-- ==== 3. M7: la residencia no lee support_cases por la API ====
drop policy if exists support_cases_select_residence on public.support_cases;

-- ==== 4. B9: sin escritura directa en seguimientos y checklist ====
drop policy if exists stay_followup_responses_insert_own on public.stay_followup_responses;
revoke insert on public.stay_followup_responses from anon, authenticated;   -- también quita los grants por columna de 0055

drop policy if exists arrival_checklist_items_insert on public.arrival_checklist_items;
drop policy if exists arrival_checklist_items_delete on public.arrival_checklist_items;
revoke insert, delete on public.arrival_checklist_items from anon, authenticated;

-- ==== 5. B10: helpers de vínculo familiar sin EXECUTE para anon ====
revoke all on function public.is_family_member_of_student(uuid) from public, anon;
revoke all on function public.is_student_linked_to_family_member(uuid) from public, anon;
grant execute on function public.is_family_member_of_student(uuid) to authenticated;
grant execute on function public.is_student_linked_to_family_member(uuid) to authenticated;

-- ==== 6. B11: exchange_rates sin metadatos del override ====
revoke select on public.exchange_rates from anon, authenticated;
grant select (
  id,
  rate_date,
  base_currency,
  quote_currency,
  official_exchange_rate_ars_per_usd,
  source_name,
  source_url,
  rate_type,
  manually_overridden,
  -- overridden_by_user_id, override_reason, notes: NO
  fetched_at,
  created_at
) on public.exchange_rates to anon, authenticated;

-- ==== 7. I2: users.blocked_reason solo service role ====
revoke select on public.users from anon, authenticated;
grant select (
  id,
  email,
  phone,
  primary_role,
  is_active,
  is_blocked,
  -- blocked_reason: NO
  last_login_at,
  preferred_notification_channel,
  created_at,
  updated_at
) on public.users to authenticated;

commit;

-- VERIFICACIÓN (SQL Editor, como postgres). Cada consulta indica el resultado esperado.
--
-- 1. Tablas con policy permissive para authenticated/public SIN su restrictiva → esperado: 0 filas.
--   select distinct p.tablename from pg_policies p
--   where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
--     and p.roles && array['authenticated', 'public']::name[]
--     and not exists (
--       select 1 from pg_policies r
--       where r.schemaname = 'public' and r.tablename = p.tablename
--         and r.policyname = p.tablename || '_only_active_users' and r.permissive = 'RESTRICTIVE')
--   order by 1;
--
-- 2. Cantidad de restrictivas → esperado: 46.
--   select count(*) from pg_policies
--   where schemaname = 'public' and permissive = 'RESTRICTIVE' and policyname like '%\_only\_active\_users';
--
-- 3. Policies que ya no deben existir (M7, B9) → esperado: 0 filas.
--   select tablename, policyname from pg_policies where schemaname = 'public' and policyname in (
--     'support_cases_select_residence', 'stay_followup_responses_insert_own',
--     'arrival_checklist_items_insert', 'arrival_checklist_items_delete');
--
-- 4. Privilegios por columna/tabla/función → esperado: todas las columnas `debe_ser_false` en false y `debe_ser_true` en true.
--   select
--     has_column_privilege('authenticated', 'public.application_negotiation_proposals', 'internal_notes', 'select') as debe_ser_false_1,
--     has_column_privilege('authenticated', 'public.application_requests', 'rejection_reason_internal', 'select') as debe_ser_false_2,
--     has_column_privilege('anon', 'public.application_requests', 'id', 'select')                                as debe_ser_false_3,
--     has_column_privilege('authenticated', 'public.users', 'blocked_reason', 'select')                           as debe_ser_false_4,
--     has_column_privilege('anon', 'public.exchange_rates', 'overridden_by_user_id', 'select')                    as debe_ser_false_5,
--     has_column_privilege('authenticated', 'public.exchange_rates', 'override_reason', 'select')                 as debe_ser_false_6,
--     has_column_privilege('authenticated', 'public.exchange_rates', 'notes', 'select')                           as debe_ser_false_7,
--     has_table_privilege('authenticated', 'public.stay_followup_responses', 'insert')                            as debe_ser_false_8,
--     has_column_privilege('authenticated', 'public.stay_followup_responses', 'comment', 'insert')                as debe_ser_false_9,
--     has_table_privilege('authenticated', 'public.arrival_checklist_items', 'insert')                            as debe_ser_false_10,
--     has_table_privilege('authenticated', 'public.arrival_checklist_items', 'delete')                            as debe_ser_false_11,
--     has_function_privilege('anon', 'public.is_family_member_of_student(uuid)', 'execute')                       as debe_ser_false_12,
--     has_function_privilege('anon', 'public.is_student_linked_to_family_member(uuid)', 'execute')                as debe_ser_false_13,
--     has_function_privilege('anon', 'public.is_active_user()', 'execute')                                        as debe_ser_false_14,
--     has_column_privilege('authenticated', 'public.application_requests', 'regulation_acceptance_pending', 'select') as debe_ser_true_1,
--     has_column_privilege('authenticated', 'public.application_negotiation_proposals', 'special_conditions', 'select') as debe_ser_true_2,
--     has_column_privilege('authenticated', 'public.users', 'is_blocked', 'select')                               as debe_ser_true_3,
--     has_column_privilege('anon', 'public.exchange_rates', 'official_exchange_rate_ars_per_usd', 'select')       as debe_ser_true_4,
--     has_table_privilege('authenticated', 'public.arrival_checklist_items', 'select')                            as debe_ser_true_5,
--     has_function_privilege('authenticated', 'public.is_active_user()', 'execute')                               as debe_ser_true_6,
--     has_function_privilege('authenticated', 'public.is_family_member_of_student(uuid)', 'execute')              as debe_ser_true_7;
--
-- 5. Columnas SIN grant de SELECT a authenticated → esperado exactamente:
--    application_negotiation_proposals.internal_notes, application_requests.rejection_reason_internal,
--    exchange_rates.{notes, override_reason, overridden_by_user_id}, users.blocked_reason.
--   select c.table_name, c.column_name from information_schema.columns c
--   where c.table_schema = 'public'
--     and c.table_name in ('application_negotiation_proposals', 'application_requests', 'exchange_rates', 'users')
--     and not has_column_privilege('authenticated', format('public.%I', c.table_name), c.column_name, 'select')
--   order by 1, 2;
--
-- VERIFICACIÓN por API (estured-dev):
--   - Con el JWT de un usuario con users.is_blocked = true: GET /rest/v1/application_requests?select=id → 200 [] (vacío);
--     GET /rest/v1/users?select=id → []. Al desbloquearlo vuelve a ver sus filas.
--   - Con el JWT de un estudiante: GET /rest/v1/application_requests?select=rejection_reason_internal → 401/403 permission denied;
--     ?select=* → idem; ?select=id,status → 200.
--   - Con el JWT de owner/staff: GET /rest/v1/support_cases?select=id → [] (salvo casos que abrió él mismo).
--   - Sin JWT (anon): GET /rest/v1/exchange_rates?select=notes → permission denied; ?select=rate_date,official_exchange_rate_ars_per_usd → 200.

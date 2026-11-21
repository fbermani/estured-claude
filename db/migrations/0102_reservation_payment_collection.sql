-- EstuRed — Migración 0102: cobro de la reserva a la residencia (DR63, fase 1: solo esquema)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción. NO está aplicada.
--    Es IDEMPOTENTE (if not exists / drop … if exists / revoke+grant) y no toca datos.
--    Necesita 0001–0101 aplicadas (usa is_active_user() de 0081 y set_updated_at()).
--
-- Fuente: docs/00 DR63 (a)–(l) y DR59 requisito 10; docs/06 §4.6, §8.1, §8.8, §11.1, §12.1 (nota 0081);
--         docs/07 §16.3–§16.10; docs/04 §5.8, §6.2–§6.3.
--
-- QUÉ HACE
--   1. Enum `external_residence_payment_status`: suma `student_reported_paid` después de `student_reference_uploaded`
--      (que queda para filas viejas). OJO: un valor nuevo de enum no se puede USAR en la misma transacción que lo crea.
--      Esta migración no lo usa en ningún lado (ni índices, ni CHECK, ni defaults). Va fuera del begin/commit.
--      Migraciones futuras que lo usen en un índice parcial o CHECK deben aplicarse en una ejecución aparte.
--      En el bootstrap (scripts/build-bootstrap.mjs) no hay problema mientras ninguna migración posterior lo use en DDL.
--   2. `residences.reservation_payment_modes` y `residences.accepted_payment_methods` (text[], nullable, SIN default).
--      Null o vacío = sin configurar = «Contacto directo por WhatsApp» (DR63 (k)). Son datos públicos: no llevan datos de cobro.
--      `residences` tiene SELECT por tabla (anon y authenticated): las dos columnas quedan visibles en la ficha pública
--      sin grant extra. Es lo buscado: DR63 (c) muestra los medios aceptados antes de enviar.
--   3. Tabla `residence_collection_accounts` (datos de cobro por medio, SENSIBLE). RLS habilitada SIN policies
--      (docs/06 §8.8: solo service role, precedente payment_settings 0038 y residence_private_details 0043).
--      Sin policy para authenticated no lleva la restrictiva `<tabla>_only_active_users` (0081).
--      Revoke explícito de todo a anon/authenticated (Supabase concede por defecto; 0090/0092 no quitan el SELECT de authenticated).
--      Escribe solo el dueño (server action, `profile.edit` restringido al dueño). El staff no lee ni escribe.
--      El admin aprueba (pending_details → details y pending_method_label → method_label). Auditoría (CBU enmascarado) y aviso
--      al dueño: en código (audit_logs + precedente notifyPaymentSettingsChange), SIN trigger: docs/06 no pide trigger.
--      MEJORA FUTURA (revisión de seguridad 2026-11-20, no se hace acá): trigger que impida escribir `details`/`method_label`
--      sin `approved_at`/`approved_by_user_id` nuevos (hoy lo garantiza solo la server action de aprobación).
--   4. `application_requests.preferred_payment_method` y `collection_mode` + `grant select (col)` a authenticated
--      (la tabla usa grants por columna desde 0081; docs/06 §11.1 lo pide explícitamente).
--   5. `external_residence_payments`: 11 columnas nuevas (docs/06 §12.1; `admin_alert_sent_at` ratificada 2026-11-20).
--      `instructions_snapshot` (alias/CBU congelados) y `admin_alert_sent_at` (marca interna del job) NO son legibles por la API:
--      revoke del SELECT de tabla a anon/authenticated + grant por columnas de todas las demás
--      (19 existentes, verificadas contra el OpenAPI de estured-dev el 2026-11-20, + 9 nuevas = 28 de 30 columnas).
--      El revoke de tabla va en un bloque condicional: solo corre si authenticated todavía tiene SELECT de tabla.
--      OJO: un REVOKE de SELECT de TABLA también borra los grants por COLUMNA. Si alguien lo repite, hay que re-correr el grant.
--      La lectura de `instructions_snapshot` va por server action con service role: dueño de la residencia, estudiante de la
--      solicitud y familiar vinculado pagador de un menor. El staff no la lee (DR63 (j) 3).
--      Código verificado con grep (2026-11-20): las lecturas con cliente de sesión piden columnas explícitas
--      (app/students/applications/[id]/page.tsx:102, lib/receipts/loadReceiptSupplement.ts:59); no hay select("*") ni embeds.
--      OJO A FUTURO: toda migración posterior que agregue una columna a external_residence_payments debe repetir su
--      `grant select (col) ... to authenticated`, o la columna no será legible con el cliente del usuario.
--   6. Índices parciales para el job de recordatorios/alertas (docs/07 §16.8) sobre timestamps, no sobre el enum nuevo.
--      El vencimiento de 48 h sigue usando `application_requests_payment_deadline_idx` (0094); la exclusión por
--      «Ya pagué» o aviso abierto se resuelve por `application_request_id` (unique de 0010).
--
-- SUPUESTOS REVERSIBLES (docs/13 §4)
--   - Claves de medios: forma `^[a-z][a-z0-9_]{1,39}$`, sin CHECK contra la lista del catálogo (vive en código,
--     lib/payments/paymentMethods.ts, DR63 (a)). El servidor valida contra el catálogo. Máximo 30 claves por residencia.
--   - Largos: details/pending_details ≤ 500 (docs/06 §8.8); method_label/pending_method_label 2–60 y sin saltos de línea; instructions_snapshot ≤ 2000
--     (un medio: etiqueta + datos ≤ 500 + margen); student_payment_issue_reason ≤ 200 (docs/06 §12.1).
--   - Etiqueta solo con `other` (docs/06 §8.8): con `other` hace falta `method_label` aprobado o `pending_method_label`;
--     con otras claves ambas son nulas. La etiqueta que se muestra y se congela sale SOLO de `method_label` (aprobada).
--   - `details` o `method_label` no nulos exigen `approved_at` no nulo (lo vigente siempre pasó por el admin).
--   - `pending_details` o `pending_method_label` no nulos exigen `pending_submitted_at` no nulo.
--   - `student_payment_issue_resolved_at` exige `student_payment_issue_at`. Si el estudiante avisa otra vez tras una
--     respuesta, el servidor pisa `student_payment_issue_at` y limpia `_resolved_at` (una sola marca por pago).
--   - Sin CHECKs entre columnas de distintas filas/tablas (ej. «enabled_methods exige medios con datos»): «Guardar cambios»
--     nunca se bloquea (DR59); el servidor valida al enviar a revisión.
--   - FKs a users con `on delete set null`; residence_id con `on delete cascade` (patrón 0043/0060; cleanup de tests).
--
-- REVERTIR (en este orden; el valor del enum no se puede quitar, es inofensivo si queda sin uso):
--   drop index if exists public.external_residence_payments_reported_paid_open_idx;
--   drop index if exists public.external_residence_payments_issue_open_idx;
--   grant select on public.external_residence_payments to authenticated;
--   alter table public.external_residence_payments drop constraint if exists external_residence_payments_dr63_checks;
--   alter table public.external_residence_payments drop column if exists expected_amount_usd, drop column if exists expected_amount_ars,
--     drop column if exists chosen_method, drop column if exists instructions_snapshot, drop column if exists student_reported_paid_at,
--     drop column if exists student_payment_issue_at, drop column if exists student_payment_issue_reason,
--     drop column if exists student_payment_issue_resolved_at, drop column if exists residence_reminder_sent_at,
--     drop column if exists student_reminder_sent_at, drop column if exists admin_alert_sent_at;
--   alter table public.application_requests drop column if exists preferred_payment_method, drop column if exists collection_mode;
--   drop table if exists public.residence_collection_accounts;
--   alter table public.residences drop column if exists reservation_payment_modes, drop column if exists accepted_payment_methods;

-- ==== 1. Enum (fuera de la transacción; no se usa en esta migración) ====
alter type public.external_residence_payment_status add value if not exists 'student_reported_paid' after 'student_reference_uploaded';

begin;

do $$
begin
  if to_regclass('public.external_residence_payments') is null then
    raise exception '0102: falta external_residence_payments (migración 0010)';
  end if;
  if to_regprocedure('public.is_active_user()') is null then
    raise exception '0102: falta is_active_user() (migración 0081)';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0102: falta set_updated_at()';
  end if;
end
$$;

-- ==== 2. residences: opciones de cobro y medios aceptados (públicos) ====
alter table public.residences add column if not exists reservation_payment_modes text[];
alter table public.residences add column if not exists accepted_payment_methods text[];

alter table public.residences drop constraint if exists residences_reservation_payment_modes_check;
alter table public.residences add constraint residences_reservation_payment_modes_check check (
  reservation_payment_modes is null
  or (
    reservation_payment_modes <@ array['enabled_methods', 'whatsapp_direct']::text[]
    and cardinality(reservation_payment_modes) <= 2
  )
);

-- Forma de las claves (sin lista fija: el catálogo vive en código). array_position(…, null) descarta elementos nulos.
alter table public.residences drop constraint if exists residences_accepted_payment_methods_check;
alter table public.residences add constraint residences_accepted_payment_methods_check check (
  accepted_payment_methods is null
  or cardinality(accepted_payment_methods) = 0
  or (
    cardinality(accepted_payment_methods) <= 30
    and array_position(accepted_payment_methods, null) is null
    and array_to_string(accepted_payment_methods, ',') ~ '^[a-z][a-z0-9_]{1,39}(,[a-z][a-z0-9_]{1,39})*$'
  )
);

comment on column public.residences.reservation_payment_modes is
  'DR63: opciones de cobro de la reserva activas (enabled_methods y/o whatsapp_direct). Null o vacío = sin configurar = whatsapp_direct. Público.';
comment on column public.residences.accepted_payment_methods is
  'DR63: claves del catálogo lib/payments/paymentMethods.ts que acepta la residencia. Público: NO lleva datos de cobro (van en residence_collection_accounts).';

-- ==== 3. residence_collection_accounts (SENSIBLE, solo service role) ====
create table if not exists public.residence_collection_accounts (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  method_key text not null,
  method_label text,
  pending_method_label text,
  details text,
  pending_details text,
  pending_submitted_at timestamptz,
  approved_by_user_id uuid references public.users (id) on delete set null,
  approved_at timestamptz,
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint residence_collection_accounts_residence_method_key unique (residence_id, method_key),
  constraint residence_collection_accounts_method_key_check check (method_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint residence_collection_accounts_label_check check (
    (method_key = 'other' and (method_label is not null or pending_method_label is not null))
    or (method_key <> 'other' and method_label is null and pending_method_label is null)
  ),
  constraint residence_collection_accounts_label_format_check check (
    (method_label is null or (char_length(btrim(method_label)) between 2 and 60 and method_label !~ '[\r\n]'))
    and (pending_method_label is null or (char_length(btrim(pending_method_label)) between 2 and 60 and pending_method_label !~ '[\r\n]'))
  ),
  constraint residence_collection_accounts_details_check check (
    details is null or char_length(btrim(details)) between 1 and 500
  ),
  constraint residence_collection_accounts_pending_details_check check (
    pending_details is null or char_length(btrim(pending_details)) between 1 and 500
  ),
  constraint residence_collection_accounts_approved_check check ((details is null and method_label is null) or approved_at is not null),
  constraint residence_collection_accounts_pending_ts_check check (
    (pending_details is null and pending_method_label is null) or pending_submitted_at is not null
  )
);

drop trigger if exists residence_collection_accounts_updated_at on public.residence_collection_accounts;
create trigger residence_collection_accounts_updated_at before update on public.residence_collection_accounts
  for each row execute function public.set_updated_at();

-- Cola del admin: cambios pendientes de aprobación.
create index if not exists residence_collection_accounts_pending_idx
  on public.residence_collection_accounts (pending_submitted_at)
  where pending_details is not null or pending_method_label is not null;

alter table public.residence_collection_accounts enable row level security;
-- SIN policies a propósito (docs/06 §8.8). NO agregar policies para authenticated: expondría alias/CBU.
revoke all on table public.residence_collection_accounts from anon, authenticated;

comment on table public.residence_collection_accounts is
  'DR63: datos de cobro de la reserva, una fila por medio y residencia. SENSIBLE. Acceso solo via service role (RLS sin policies a propósito). Escribe el dueño (pending_details), aprueba el admin (details).';
comment on column public.residence_collection_accounts.details is
  'Datos de cobro APROBADOS y vigentes (alias, CBU, usuario o instrucciones). Solo estos se ofrecen y se congelan en instructions_snapshot.';
comment on column public.residence_collection_accounts.method_label is
  'Nombre APROBADO del medio «other». Es el único que se muestra al estudiante y se congela en instructions_snapshot.';
comment on column public.residence_collection_accounts.pending_method_label is
  'Nombre nuevo del medio «other» a la espera de aprobación del admin (mismo flujo que pending_details). No se muestra al estudiante ni se congela.';
comment on column public.residence_collection_accounts.pending_details is
  'Datos nuevos a la espera de aprobación del admin (DR63 (j) 5). No se muestran a nadie fuera del dueño y el admin. Nunca se congelan.';

-- ==== 4. application_requests: preferencia del estudiante y camino de cobro ====
alter table public.application_requests add column if not exists preferred_payment_method text;
alter table public.application_requests add column if not exists collection_mode text;

alter table public.application_requests drop constraint if exists application_requests_preferred_payment_method_check;
alter table public.application_requests add constraint application_requests_preferred_payment_method_check check (
  preferred_payment_method is null or preferred_payment_method ~ '^[a-z][a-z0-9_]{1,39}$'
);

alter table public.application_requests drop constraint if exists application_requests_collection_mode_check;
alter table public.application_requests add constraint application_requests_collection_mode_check check (
  collection_mode is null or collection_mode in ('enabled_methods', 'whatsapp_direct')
);

grant select (preferred_payment_method, collection_mode) on public.application_requests to authenticated;

comment on column public.application_requests.preferred_payment_method is
  'DR63 (c): clave del catálogo que prefiere el estudiante. Opcional, no vinculante. Null = «Lo coordino con la residencia».';
comment on column public.application_requests.collection_mode is
  'DR63: camino elegido al aceptar (enabled_methods | whatsapp_direct). Null en solicitudes anteriores = whatsapp_direct. DR63 (l) puede pasarlo a whatsapp_direct.';

-- ==== 5. external_residence_payments: monto/medio fijados, «Ya pagué», «No pude realizar el pago» ====
alter table public.external_residence_payments add column if not exists expected_amount_usd numeric(14, 2);
alter table public.external_residence_payments add column if not exists expected_amount_ars numeric(14, 2);
alter table public.external_residence_payments add column if not exists chosen_method text;
alter table public.external_residence_payments add column if not exists instructions_snapshot text;
alter table public.external_residence_payments add column if not exists student_reported_paid_at timestamptz;
alter table public.external_residence_payments add column if not exists student_payment_issue_at timestamptz;
alter table public.external_residence_payments add column if not exists student_payment_issue_reason text;
alter table public.external_residence_payments add column if not exists student_payment_issue_resolved_at timestamptz;
alter table public.external_residence_payments add column if not exists residence_reminder_sent_at timestamptz;
alter table public.external_residence_payments add column if not exists student_reminder_sent_at timestamptz;
alter table public.external_residence_payments add column if not exists admin_alert_sent_at timestamptz;

alter table public.external_residence_payments drop constraint if exists external_residence_payments_dr63_checks;
alter table public.external_residence_payments add constraint external_residence_payments_dr63_checks check (
  (expected_amount_usd is null or expected_amount_usd >= 0)
  and (expected_amount_ars is null or expected_amount_ars >= 0)
  and (chosen_method is null or chosen_method ~ '^[a-z][a-z0-9_]{1,39}$')
  and (instructions_snapshot is null or char_length(instructions_snapshot) <= 2000)
  and (student_payment_issue_reason is null or char_length(student_payment_issue_reason) <= 200)
  and (student_payment_issue_resolved_at is null or student_payment_issue_at is not null)
);

-- instructions_snapshot fuera de la API: revoke de tabla + grant por columnas (patrón 0081).
-- Condicional: un revoke de TABLA borra también los grants por columna; solo se hace si sigue el SELECT de tabla.
do $$
begin
  if has_table_privilege('authenticated', 'public.external_residence_payments', 'select') then
    revoke select on public.external_residence_payments from authenticated;
  end if;
  if has_table_privilege('anon', 'public.external_residence_payments', 'select') then
    revoke select on public.external_residence_payments from anon;
  end if;
end
$$;
grant select (
  id,
  application_request_id,
  reservation_id,
  residence_id,
  student_profile_id,
  status,
  amount_reported_usd,
  amount_reported_ars,
  payment_concept,
  payment_method_to_residence,
  student_proof_file_id,
  residence_receipt_file_id,
  reported_received_by_user_id,
  reported_received_at,
  mark_received_consent_id,
  dispute_reason,
  created_at,
  updated_at,
  renewal_offer_id,                    -- 0017
  expected_amount_usd,                 -- 0102
  expected_amount_ars,                 -- 0102
  chosen_method,                       -- 0102
  -- instructions_snapshot: NO (solo service role, DR63 (j) 3)
  student_reported_paid_at,            -- 0102
  student_payment_issue_at,            -- 0102
  student_payment_issue_reason,        -- 0102
  student_payment_issue_resolved_at,   -- 0102
  residence_reminder_sent_at,          -- 0102
  student_reminder_sent_at             -- 0102
  -- admin_alert_sent_at: NO (marca interna del job, solo service role)
) on public.external_residence_payments to authenticated;

comment on column public.external_residence_payments.instructions_snapshot is
  'DR63: datos de cobro (alias/CBU) congelados al habilitar el pago. SENSIBLE: sin SELECT para anon/authenticated. Lee solo service role (dueño, estudiante de la solicitud, familiar pagador de un menor). El staff no.';
comment on column public.external_residence_payments.chosen_method is
  'DR63: clave del catálogo fijada por la residencia. Distinta de payment_method_to_residence (la informa el estudiante).';
comment on column public.external_residence_payments.student_reported_paid_at is
  'DR63 (e): momento de «Ya pagué». Detiene el vencimiento de 48 h.';
comment on column public.external_residence_payments.student_payment_issue_at is
  'DR63 (l): momento de «No pude realizar el pago». Con _resolved_at nulo, detiene el vencimiento. El estado sigue en pending.';
comment on column public.external_residence_payments.admin_alert_sent_at is
  'DR63 (j) 1: marca de la alerta al admin (y caso de Soporte) a las 72 h de «Ya pagué» o de «No pude realizar el pago» sin respuesta. Evita que el job la repita. Interna: sin SELECT para anon/authenticated. El servidor la limpia (con los otros *_sent_at) en cada evento nuevo.';

-- ==== 6. Índices parciales para el job de recordatorios/alertas (docs/07 §16.8) ====
-- Sobre timestamps y estados VIEJOS del enum: el valor nuevo no se puede usar en esta transacción.
-- `admin_alert_sent_at is null`: tras la alerta de 72 h la fila sale del índice (sirve igual para el aviso de 24 h, que es anterior).
-- «Ya pagué» sin «Pago recibido» ni disputa: aviso a la residencia a 24 h, alerta al admin a 72 h.
create index if not exists external_residence_payments_reported_paid_open_idx
  on public.external_residence_payments (student_reported_paid_at)
  where student_reported_paid_at is not null
    and reported_received_at is null
    and admin_alert_sent_at is null
    and status not in ('reported_received_by_residence', 'expired', 'disputed');

-- «No pude realizar el pago» sin respuesta de la residencia: mismos plazos.
create index if not exists external_residence_payments_issue_open_idx
  on public.external_residence_payments (student_payment_issue_at)
  where student_payment_issue_at is not null
    and student_payment_issue_resolved_at is null
    and admin_alert_sent_at is null
    and status not in ('reported_received_by_residence', 'expired', 'disputed');

commit;

-- VERIFICACIONES POST-APLICACIÓN (SQL Editor, como postgres). Cada consulta indica el resultado esperado.
--
-- 1. Enum con el valor nuevo en su lugar → esperado: {not_required_yet,pending,student_reference_uploaded,
--    student_reported_paid,reported_received_by_residence,expired,disputed}
--   select enum_range(null::public.external_residence_payment_status);
--
-- 2. Privilegios → esperado: todas las `debe_ser_false` en false y todas las `debe_ser_true` en true.
--   select
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'instructions_snapshot', 'select') as debe_ser_false_1,
--     has_column_privilege('anon', 'public.external_residence_payments', 'instructions_snapshot', 'select')          as debe_ser_false_2,
--     has_table_privilege('authenticated', 'public.external_residence_payments', 'select')                           as debe_ser_false_3,
--     has_table_privilege('authenticated', 'public.residence_collection_accounts', 'select')                         as debe_ser_false_4,
--     has_table_privilege('anon', 'public.residence_collection_accounts', 'select')                                  as debe_ser_false_5,
--     has_table_privilege('authenticated', 'public.residence_collection_accounts', 'insert')                         as debe_ser_false_6,
--     has_table_privilege('authenticated', 'public.residence_collection_accounts', 'update')                         as debe_ser_false_7,
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'admin_alert_sent_at', 'select')   as debe_ser_false_8,
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'expected_amount_usd', 'select')   as debe_ser_true_1,
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'student_reported_paid_at', 'select') as debe_ser_true_2,
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'renewal_offer_id', 'select')      as debe_ser_true_3,
--     has_column_privilege('authenticated', 'public.external_residence_payments', 'status', 'select')                as debe_ser_true_4,
--     has_column_privilege('authenticated', 'public.application_requests', 'preferred_payment_method', 'select')      as debe_ser_true_5,
--     has_column_privilege('authenticated', 'public.application_requests', 'collection_mode', 'select')               as debe_ser_true_6,
--     has_column_privilege('anon', 'public.residences', 'accepted_payment_methods', 'select')                        as debe_ser_true_7,
--     has_column_privilege('authenticated', 'public.residences', 'reservation_payment_modes', 'select')              as debe_ser_true_8;
--
-- 3. Columnas nuevas de external_residence_payments legibles por authenticated → esperado: 9 filas, todas true
--    (las 11 nuevas menos instructions_snapshot y admin_alert_sent_at). En total: 28 de 30 columnas concedidas.
--   select column_name, has_column_privilege('authenticated', 'public.external_residence_payments', column_name, 'select') as ok
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'external_residence_payments'
--     and column_name in ('expected_amount_usd', 'expected_amount_ars', 'chosen_method', 'student_reported_paid_at',
--       'student_payment_issue_at', 'student_payment_issue_reason', 'student_payment_issue_resolved_at',
--       'residence_reminder_sent_at', 'student_reminder_sent_at')
--   order by 1;
--
-- 4. Columnas SIN SELECT para authenticated (re-corrida de la verificación 5 de 0081 con external_residence_payments)
--    → esperado exactamente: application_negotiation_proposals.internal_notes, application_requests.rejection_reason_internal,
--    exchange_rates.{notes, override_reason, overridden_by_user_id},
--    external_residence_payments.{admin_alert_sent_at, instructions_snapshot},
--    users.blocked_reason.
--   select c.table_name, c.column_name from information_schema.columns c
--   where c.table_schema = 'public'
--     and c.table_name in ('application_negotiation_proposals', 'application_requests', 'exchange_rates', 'users',
--       'external_residence_payments')
--     and not has_column_privilege('authenticated', format('public.%I', c.table_name), c.column_name, 'select')
--   order by 1, 2;
--
-- 5. residence_collection_accounts: RLS activa y sin policies → esperado: rowsecurity = true; 0 policies.
--   select relrowsecurity as rowsecurity from pg_class where oid = 'public.residence_collection_accounts'::regclass;
--   select count(*) as policies from pg_policies where schemaname = 'public' and tablename = 'residence_collection_accounts';
--
-- 6. external_residence_payments conserva su policy de SELECT y la restrictiva de 0081 → esperado: 2 filas
--    (external_residence_payments_select_related PERMISSIVE, external_residence_payments_only_active_users RESTRICTIVE).
--   select policyname, permissive, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'external_residence_payments' order by 1;
--
-- 7. Ninguna tabla con policy permissive para authenticated sin su restrictiva (verificación 1 de 0081) → esperado: 0 filas.
--   select distinct p.tablename from pg_policies p
--   where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
--     and p.roles && array['authenticated', 'public']::name[]
--     and not exists (
--       select 1 from pg_policies r
--       where r.schemaname = 'public' and r.tablename = p.tablename
--         and r.policyname = p.tablename || '_only_active_users' and r.permissive = 'RESTRICTIVE')
--   order by 1;
--
-- 8. Constraints e índices nuevos → esperado: 5 constraints CHECK y 3 índices parciales.
--   select conrelid::regclass as tabla, conname from pg_constraint
--   where conname in ('residences_reservation_payment_modes_check', 'residences_accepted_payment_methods_check',
--     'application_requests_preferred_payment_method_check', 'application_requests_collection_mode_check',
--     'external_residence_payments_dr63_checks')
--   order by 1, 2;
--   select indexname from pg_indexes where schemaname = 'public' and indexname in (
--     'external_residence_payments_reported_paid_open_idx', 'external_residence_payments_issue_open_idx',
--     'residence_collection_accounts_pending_idx');
--
-- VERIFICACIÓN por API (estured-dev):
--   - JWT de estudiante: GET /rest/v1/external_residence_payments?select=instructions_snapshot → permission denied;
--     ?select=* → permission denied; ?select=id,status,student_reported_paid_at → 200.
--   - JWT de owner/staff: GET /rest/v1/residence_collection_accounts?select=id → permission denied.
--   - Sin JWT (anon): GET /rest/v1/residences?select=accepted_payment_methods&status=eq.verified_active → 200.

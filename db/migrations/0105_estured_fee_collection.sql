-- EstuRed — Migración 0105: cobro del fee EstuRed con medios del catálogo (DR64, Pista 2, paso A: solo esquema)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla en producción cuando se arme (entra sola con scripts/build-bootstrap.mjs).
--    En estured-dev la aplica el agente. Es ADITIVA e IDEMPOTENTE (if not exists / drop … if exists / grant) y no toca datos.
--    Necesita 0010, 0011, 0047 y 0050 aplicadas (esquema de estured_fee_payments y sus grants por columna).
--
-- Fuente: docs/00 DR64 (a)–(h) y DR63 (i); docs/06 §8.9 y §13.2; docs/07 §17.6–§17.11; docs/04 §8.10.
--
-- QUÉ HACE
--   1. Tabla `estured_fee_collection_methods`: un medio del catálogo (lib/payments/paymentMethods.ts) por fila, con SUS datos de cobro
--      de EstuRed, su moneda (ARS o USD) y `is_enabled`. SENSIBLE: RLS habilitada SIN policies y `revoke all` a anon/authenticated
--      (precedente `payment_settings` 0038 y `residence_collection_accounts` 0102). Escribe solo un superadmin, por server action,
--      con auditoría (datos enmascarados) y aviso a todos los superadmin (DR64 (a)). SIN aprobación de un segundo admin y SIN trigger.
--      No copia el CBU de `payment_settings`: el paso B lee esa fila como respaldo de `transfer_ars` mientras esta tabla esté vacía.
--   2. `estured_fee_payments`: 12 columnas nuevas (docs/06 §13.2). El equipo de la residencia LEE esta tabla por RLS
--      (`estured_fee_payments_select_related`, 0010), así que todo grant de columna lo ve la residencia:
--        con grant (4): chosen_method, student_reported_paid_at, student_payment_issue_at, student_payment_issue_resolved_at;
--        SIN grant (8, solo service role): instructions_snapshot (datos de cobro congelados), student_payment_issue_reason y
--        admin_dispute_reason (texto libre), admin_disputed_at, admin_disputed_by_user_id y las marcas internas del job
--        payer_reminder_sent_at, admin_reminder_sent_at y admin_alert_sent_at (ninguna pantalla las lee con sesión de usuario).
--      Se usa solo `grant select (col)`: NO se repite el revoke de TABLA de 0047 (borraría los grants por columna ya concedidos).
--      OJO A FUTURO: toda migración que agregue una columna a estured_fee_payments debe repetir su `grant select (col)` si quiere que
--      sea legible con el cliente del usuario; sin grant, solo el service role la ve.
--   3. Índices parciales para el job de recordatorios y alertas (docs/07 §17.10), sobre timestamps y estados que ya existían.
--
-- SIN ESTADO NUEVO. `estured_fee_status` no cambia: «Ya pagué» del fee sigue siendo `pending_manual_payment` (con comprobante
-- obligatorio, DR8 (1)). «No recibí el pago» del admin NO es un valor del enum: es `admin_disputed_at` con el fee en
-- `pending_manual_payment` y la reserva en `pending_estured_fee` (DR64 (d)). docs/04 y types/domain.ts no cambian de estados.
--
-- SUPUESTOS REVERSIBLES (docs/13 §4)
--   - Claves de medios: forma `^[a-z][a-z0-9_]{1,39}$`, sin CHECK contra el catálogo (vive en código). El servidor valida contra él.
--   - Largos: details ≤ 500 (como residence_collection_accounts); method_label 2–60 y una línea; instructions_snapshot ≤ 2000;
--     student_payment_issue_reason ≤ 200; admin_dispute_reason 10–500.
--   - Etiqueta solo con `other` (patrón 0102).
--   - `admin_disputed_at`, `admin_dispute_reason` y `admin_disputed_by_user_id` van los tres o ninguno.
--   - `student_payment_issue_resolved_at` exige `student_payment_issue_at` (una marca por pago; un aviso nuevo pisa y limpia la resolución).
--   - Sin contador de reaperturas: el tope (máx. 2 reaperturas y 7 días sin respuesta) está propuesto en docs/00 DR64 (g) y NO se implementa.
--     Si el dueño lo aprueba, se suma una columna en una migración aparte.
--
-- REVERTIR (en este orden):
--   drop index if exists public.estured_fee_payments_reported_open_idx;
--   drop index if exists public.estured_fee_payments_issue_open_idx;
--   alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_dr64_checks;
--   alter table public.estured_fee_payments
--     drop column if exists chosen_method, drop column if exists instructions_snapshot, drop column if exists student_reported_paid_at,
--     drop column if exists student_payment_issue_at, drop column if exists student_payment_issue_reason,
--     drop column if exists student_payment_issue_resolved_at, drop column if exists admin_disputed_at,
--     drop column if exists admin_dispute_reason, drop column if exists admin_disputed_by_user_id,
--     drop column if exists payer_reminder_sent_at, drop column if exists admin_reminder_sent_at, drop column if exists admin_alert_sent_at;
--   drop table if exists public.estured_fee_collection_methods;

begin;

do $$
begin
  if to_regclass('public.estured_fee_payments') is null then
    raise exception '0105: falta estured_fee_payments (migración 0010)';
  end if;
  if to_regclass('public.users') is null then
    raise exception '0105: falta users';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0105: falta set_updated_at()';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'estured_fee_payments' and column_name = 'validated_by_user_id'
  ) then
    raise exception '0105: falta estured_fee_payments.validated_by_user_id (migración 0050)';
  end if;
  -- 0047 convirtió el SELECT de tabla en grants por columna. Si authenticated lo conserva, un grant por columna no protegería nada.
  if has_table_privilege('authenticated', 'public.estured_fee_payments', 'select') then
    raise exception '0105: authenticated conserva SELECT de tabla en estured_fee_payments; aplicá 0047 primero';
  end if;
end
$$;

-- ==== 1. estured_fee_collection_methods (SENSIBLE, solo service role) ====
create table if not exists public.estured_fee_collection_methods (
  id uuid primary key default gen_random_uuid(),
  method_key text not null,
  method_label text,
  details text not null,
  currency text not null,
  is_enabled boolean not null default false,
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estured_fee_collection_methods_method_key_key unique (method_key),
  constraint estured_fee_collection_methods_method_key_check check (method_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint estured_fee_collection_methods_currency_check check (currency in ('ARS', 'USD')),
  constraint estured_fee_collection_methods_label_check check (
    (method_key = 'other' and method_label is not null)
    or (method_key <> 'other' and method_label is null)
  ),
  constraint estured_fee_collection_methods_label_format_check check (
    method_label is null or (char_length(btrim(method_label)) between 2 and 60 and method_label !~ '[\r\n]')
  ),
  constraint estured_fee_collection_methods_details_check check (char_length(btrim(details)) between 1 and 500)
);

drop trigger if exists estured_fee_collection_methods_updated_at on public.estured_fee_collection_methods;
create trigger estured_fee_collection_methods_updated_at before update on public.estured_fee_collection_methods
  for each row execute function public.set_updated_at();

alter table public.estured_fee_collection_methods enable row level security;
-- SIN policies a propósito (docs/06 §8.9). NO agregar policies para authenticated: expondría los datos de cobro de EstuRed.
-- Sin policy para authenticated no lleva la restrictiva `<tabla>_only_active_users` (0081).
revoke all on table public.estured_fee_collection_methods from anon, authenticated;

comment on table public.estured_fee_collection_methods is
  'DR64: medios con los que EstuRed cobra SU fee (uno por medio del catálogo), con datos de cobro propios y moneda. SENSIBLE. Acceso solo via service role (RLS sin policies a propósito). Escribe un superadmin con auditoría y aviso a los superadmin. Distinta de residence_collection_accounts (datos de la residencia).';
comment on column public.estured_fee_collection_methods.details is
  'Datos de cobro de EstuRed (alias, CBU, usuario o instrucciones). Solo se ofrecen los de filas con is_enabled. Se congelan en estured_fee_payments.instructions_snapshot al elegir el medio.';
comment on column public.estured_fee_collection_methods.currency is
  'Moneda en la que se cobra el fee por este medio (ARS o USD). Fija estured_fee_payments.payment_currency y la comparación de monto de DR8 (2).';
comment on column public.estured_fee_collection_methods.method_label is
  'Nombre libre del medio «other» (2 a 60 caracteres). Null para el resto del catálogo.';

-- ==== 2. estured_fee_payments: medio elegido, «Ya pagué», «No pude realizar el pago», «No recibí el pago» ====
alter table public.estured_fee_payments add column if not exists chosen_method text;
alter table public.estured_fee_payments add column if not exists instructions_snapshot text;
alter table public.estured_fee_payments add column if not exists student_reported_paid_at timestamptz;
alter table public.estured_fee_payments add column if not exists student_payment_issue_at timestamptz;
alter table public.estured_fee_payments add column if not exists student_payment_issue_reason text;
alter table public.estured_fee_payments add column if not exists student_payment_issue_resolved_at timestamptz;
alter table public.estured_fee_payments add column if not exists admin_disputed_at timestamptz;
alter table public.estured_fee_payments add column if not exists admin_dispute_reason text;
alter table public.estured_fee_payments add column if not exists admin_disputed_by_user_id uuid references public.users (id) on delete set null;
alter table public.estured_fee_payments add column if not exists payer_reminder_sent_at timestamptz;
alter table public.estured_fee_payments add column if not exists admin_reminder_sent_at timestamptz;
alter table public.estured_fee_payments add column if not exists admin_alert_sent_at timestamptz;

alter table public.estured_fee_payments drop constraint if exists estured_fee_payments_dr64_checks;
alter table public.estured_fee_payments add constraint estured_fee_payments_dr64_checks check (
  (chosen_method is null or chosen_method ~ '^[a-z][a-z0-9_]{1,39}$')
  and (instructions_snapshot is null or char_length(instructions_snapshot) <= 2000)
  and (student_payment_issue_reason is null or char_length(student_payment_issue_reason) <= 200)
  and (student_payment_issue_resolved_at is null or student_payment_issue_at is not null)
  and (
    (admin_disputed_at is null and admin_dispute_reason is null and admin_disputed_by_user_id is null)
    or (
      admin_disputed_at is not null and admin_dispute_reason is not null and admin_disputed_by_user_id is not null
      and char_length(btrim(admin_dispute_reason)) between 10 and 500
    )
  )
);

-- Solo estas 4 columnas se conceden (la residencia las ve por RLS: son fechas y una clave del catálogo, sin texto libre ni datos de cobro).
-- Sin revoke de tabla (0047 ya lo hizo; repetirlo borraría los grants por columna).
grant select (
  chosen_method,
  student_reported_paid_at,
  student_payment_issue_at,
  student_payment_issue_resolved_at
) on public.estured_fee_payments to authenticated;

comment on column public.estured_fee_payments.chosen_method is
  'DR64 (b): clave del catálogo que eligió el pagador. Se puede cambiar mientras el fee esté en pending_payment_method; al informar el pago queda fija.';
comment on column public.estured_fee_payments.instructions_snapshot is
  'DR64: datos de cobro de EstuRed congelados al elegir el medio. SENSIBLE: sin SELECT para anon/authenticated. Lee solo service role (pagador designado de la reserva y admin). La residencia no.';
comment on column public.estured_fee_payments.student_reported_paid_at is
  'DR64 (c): momento de «Ya pagué» (fee en pending_manual_payment, comprobante obligatorio, DR8 (1)). Un fee en pending_manual_payment no vence: el job lo excluye.';
comment on column public.estured_fee_payments.student_payment_issue_at is
  'DR64 (e): momento de «No pude realizar el pago». Con _resolved_at nulo, detiene el vencimiento de 48 h. El estado sigue en pending_payment_method.';
comment on column public.estured_fee_payments.student_payment_issue_reason is
  'DR64 (e): motivo opcional (máx. 200) que escribe el pagador para EstuRed. Texto libre: sin SELECT para anon/authenticated (la residencia lee esta tabla por RLS).';
comment on column public.estured_fee_payments.admin_disputed_at is
  'DR64 (d): «No recibí el pago» del admin. NO es un estado: el fee sigue en pending_manual_payment y la reserva en pending_estured_fee. Interna: sin SELECT para anon/authenticated.';
comment on column public.estured_fee_payments.admin_dispute_reason is
  'DR64 (d): motivo del admin (10 a 500). Texto libre interno: sin SELECT para anon/authenticated.';
comment on column public.estured_fee_payments.admin_alert_sent_at is
  'DR64 (f): marca de la alerta al admin y caso de Soporte a las 72 h de «Ya pagué» o de «No pude realizar el pago» sin respuesta. Interna: sin SELECT para anon/authenticated. El servidor limpia las tres marcas *_sent_at en cada evento nuevo.';
comment on column public.estured_fee_payments.payer_reminder_sent_at is
  'DR64 (f): marca del aviso al pagador 12 h antes del vencimiento (sin «Ya pagué» ni aviso de problema). Interna.';
comment on column public.estured_fee_payments.admin_reminder_sent_at is
  'DR64 (f): marca del aviso al admin a las 24 h de «Ya pagué» o de «No pude realizar el pago» sin respuesta. Interna.';

-- ==== 3. Índices parciales para el job de recordatorios/alertas (docs/07 §17.10) ====
-- «Ya pagué» sin validar ni disputa: aviso al admin a 24 h, alerta a 72 h.
create index if not exists estured_fee_payments_reported_open_idx
  on public.estured_fee_payments (student_reported_paid_at)
  where status = 'pending_manual_payment'
    and student_reported_paid_at is not null
    and admin_disputed_at is null
    and admin_alert_sent_at is null;

-- «No pude realizar el pago» sin respuesta del admin: mismos plazos.
create index if not exists estured_fee_payments_issue_open_idx
  on public.estured_fee_payments (student_payment_issue_at)
  where status = 'pending_payment_method'
    and student_payment_issue_at is not null
    and student_payment_issue_resolved_at is null
    and admin_alert_sent_at is null;

commit;

-- VERIFICACIONES POST-APLICACIÓN (SQL Editor, como postgres). Cada consulta indica el resultado esperado.
--
-- 1. Privilegios → esperado: las `debe_ser_false` en false y las `debe_ser_true` en true.
--   select
--     has_table_privilege('authenticated', 'public.estured_fee_collection_methods', 'select')                      as debe_ser_false_1,
--     has_table_privilege('anon', 'public.estured_fee_collection_methods', 'select')                                as debe_ser_false_2,
--     has_table_privilege('authenticated', 'public.estured_fee_collection_methods', 'insert')                       as debe_ser_false_3,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'instructions_snapshot', 'select')       as debe_ser_false_4,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'student_payment_issue_reason', 'select') as debe_ser_false_5,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'admin_dispute_reason', 'select')        as debe_ser_false_6,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'admin_disputed_at', 'select')           as debe_ser_false_7,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'admin_alert_sent_at', 'select')         as debe_ser_false_8,
--     has_table_privilege('authenticated', 'public.estured_fee_payments', 'select')                                 as debe_ser_false_9,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'chosen_method', 'select')               as debe_ser_true_1,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'student_reported_paid_at', 'select')    as debe_ser_true_2,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'status', 'select')                      as debe_ser_true_3,
--     has_column_privilege('authenticated', 'public.estured_fee_payments', 'manual_payment_file_id', 'select')      as debe_ser_true_4;
--
-- 2. Columnas de estured_fee_payments SIN SELECT para authenticated → esperado: las de 0047/0049/0050 más las 8 internas de esta
--    migración (instructions_snapshot, student_payment_issue_reason, admin_disputed_at, admin_dispute_reason,
--    admin_disputed_by_user_id, payer_reminder_sent_at, admin_reminder_sent_at, admin_alert_sent_at).
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'estured_fee_payments'
--     and not has_column_privilege('authenticated', 'public.estured_fee_payments', column_name, 'select')
--   order by 1;
--
-- 3. RLS de la tabla nueva activa y sin policies → esperado: rowsecurity = true; policies = 0.
--   select relrowsecurity as rowsecurity from pg_class where oid = 'public.estured_fee_collection_methods'::regclass;
--   select count(*) as policies from pg_policies where schemaname = 'public' and tablename = 'estured_fee_collection_methods';
--
-- 4. estured_fee_payments conserva sus 2 policies (select_related PERMISSIVE y only_active_users RESTRICTIVE) → esperado: 2 filas.
--   select policyname, permissive, cmd from pg_policies where schemaname = 'public' and tablename = 'estured_fee_payments' order by 1;
--
-- 5. Enum intacto → esperado: not_required_yet,pending_payment_method,pending_manual_payment,pending_auto_charge,processing,paid,failed,expired,refunded,chargeback
--   select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'estured_fee_status';
--
-- 6. Constraints e índices nuevos → esperado: 9 filas de constraints (pkey, fkey, unique y 5 checks de la tabla nueva, más estured_fee_payments_dr64_checks) y 2 índices.
--   select conname from pg_constraint where conname like 'estured_fee_collection_methods_%' or conname = 'estured_fee_payments_dr64_checks' order by 1;
--   select indexname from pg_indexes where schemaname = 'public' and indexname in ('estured_fee_payments_reported_open_idx', 'estured_fee_payments_issue_open_idx');
--
-- VERIFICACIÓN por API (estured-dev, con un JWT de estudiante):
--   GET /rest/v1/estured_fee_payments?select=instructions_snapshot → 42501 permission denied;
--   GET /rest/v1/estured_fee_payments?select=id,status,chosen_method,student_reported_paid_at → 200;
--   GET /rest/v1/estured_fee_collection_methods?select=id → 42501 permission denied.

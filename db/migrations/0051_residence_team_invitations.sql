-- EstuRed — Migración 0051: invitaciones al equipo de una residencia (Ciclo 73, DR10)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). Orden pendiente: 0046, 0045, 0047, 0048, 0049, 0050, 0051.
--    NO está aplicada. Es ADITIVA e IDEMPOTENTE (create ... if not exists, drop/add constraint) y no modifica ninguna fila existente (agrega además una restricción CHECK a `residence_users.permissions`, ver 1b: `not valid` + validación solo si ninguna fila la viola).
--    No depende de las migraciones 0045–0050: solo necesita `residences`, `users` y `residence_users` (0002/0003).
--    Hasta que se aplique, el código degrada con gracia: la pantalla Equipo (`/residence/[id]/team`) muestra la lista de miembros y permite
--    quitar acceso a un staff, pero NO se puede invitar, reenviar ni cancelar (se avisa con claridad) y el enlace de aceptación se muestra
--    como "inválido". Los permisos dueño/staff NO dependen de esta migración: usan `residence_users.role`, que ya existe desde la 0003.
--
-- MOTIVO. DR10 (docs/00 §31): el dueño invita por email a su staff. La invitación se hace ANTES de que la persona tenga cuenta o vínculo con
-- la residencia, así que no puede vivir en `residence_users` (que exige `user_id`). Se modela aparte, igual que `family_invitations` (0034),
-- pero con token de un solo uso, vencimiento y límites. Aceptar la invitación es lo que crea (o reactiva) la fila de `residence_users`
-- con `role = 'staff'`: una invitación NUNCA puede crear un dueño.
--
-- QUÉ HACE
--   1. Crea `residence_team_invitations`:
--        residence_id        residencia a la que se invita (on delete cascade)
--        email               email invitado, en minúsculas (3 a 200 caracteres)
--        role                siempre 'staff' (CHECK: no se puede elevar a dueño por esta vía)
--        permissions         permisos iniciales que eligió el dueño al invitar (DR11, jsonb con las 10 claves booleanas); se copian a `residence_users.permissions` al aceptar. Por defecto '{}' = valores iniciales del producto
--        token_hash          SHA-256 (hex, 64 caracteres) del token del enlace; el token en claro NO se guarda; único
--        status              'pending' | 'accepted' | 'cancelled' (el vencimiento se deduce de `expires_at`, no es un estado guardado)
--        invited_by          dueño que invitó (users.id); nullable con on delete set null: si se borra la cuenta, la invitación pendiente deja de poder aceptarse
--        expires_at          7 días desde el envío o el último reenvío
--        last_sent_at / send_count   último envío y cantidad de envíos (base del límite de invitaciones por hora y por residencia)
--        accepted_at / accepted_by_user_id / cancelled_at   trazabilidad
--      CHECKs de forma: `accepted` trae accepted_at (accepted_by_user_id puede quedar nulo si se borra esa cuenta: on delete set null); `cancelled` trae cancelled_at; `pending` no trae ninguno.
--      Idempotente frente a una versión previa ya aplicada: vuelve a dejar `invited_by` nullable y recrea con NOMBRE explícito y `on delete set null` las dos
--      FK a `users` (`invited_by` y `accepted_by_user_id`), por si una versión anterior las dejó `not null` o sin `on delete`.
--   1b. `residence_users.permissions` (DR11): CHECK de que sea SIEMPRE un objeto jsonb (`jsonb_typeof(permissions) = 'object'`), agregado `not valid` y validado
--      solo si ninguna fila lo viola (si alguna lo viola, la restricción rige para filas nuevas y modificadas y queda un aviso: el código ya trata un valor
--      que no es objeto como "sin permisos", falla cerrado). NO valida que los valores sean booleanos: eso lo hace el servidor (`resolveStaffPermissions`).
--   2. Una sola invitación `pending` por (residencia, email en minúsculas): índice único parcial.
--   3. RLS habilitada SIN policies para usuarios: solo el service role (server actions) lee y escribe. Además se revoca todo a `anon` y
--      `authenticated` (defensa en profundidad; el token_hash no debe ser legible por la API con la anon key / un JWT).
--
-- NO hay backfill: la tabla nace vacía. Los vínculos actuales de `residence_users` (owner/staff) no cambian.
--
-- REVERTIR (borra las invitaciones; los vínculos de `residence_users` ya creados al aceptar NO se tocan; el código vuelve a degradar con gracia):
--   drop table if exists public.residence_team_invitations;
--   alter table public.residence_users drop constraint if exists residence_users_permissions_object_check;

begin;

-- ==== 0. Guarda: tienen que existir las tablas a las que referencia ====
do $$
begin
  if to_regclass('public.residences') is null
     or to_regclass('public.users') is null
     or to_regclass('public.residence_users') is null then
    raise exception '0051: faltan residences / users / residence_users (migraciones 0002 y 0003)';
  end if;
end
$$;

-- ==== 1. Tabla de invitaciones ====
create table if not exists public.residence_team_invitations (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 200 and email = lower(email)),
  role text not null default 'staff' check (role = 'staff'),
  permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions) = 'object'),
  token_hash text not null check (char_length(token_hash) = 64),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by uuid references public.users (id) on delete set null,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1 check (send_count >= 1),
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.users (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.residence_team_invitations drop constraint if exists residence_team_invitations_shape_check;
alter table public.residence_team_invitations add constraint residence_team_invitations_shape_check
  check (
    (status = 'pending' and accepted_at is null and accepted_by_user_id is null and cancelled_at is null)
    or (status = 'accepted' and accepted_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and accepted_at is null and accepted_by_user_id is null)
  );

-- Idempotente frente a una versión previa ya aplicada: `invited_by` nullable y las dos FK a `users` recreadas con nombre explícito y `on delete set null`.
alter table public.residence_team_invitations alter column invited_by drop not null;
alter table public.residence_team_invitations drop constraint if exists residence_team_invitations_invited_by_fkey;
alter table public.residence_team_invitations add constraint residence_team_invitations_invited_by_fkey
  foreign key (invited_by) references public.users (id) on delete set null;
alter table public.residence_team_invitations drop constraint if exists residence_team_invitations_accepted_by_user_id_fkey;
alter table public.residence_team_invitations add constraint residence_team_invitations_accepted_by_user_id_fkey
  foreign key (accepted_by_user_id) references public.users (id) on delete set null;

-- Idempotente: si una versión anterior de esta migración (sin permisos) llegó a aplicarse, agrega la columna.
alter table public.residence_team_invitations add column if not exists permissions jsonb not null default '{}'::jsonb;
alter table public.residence_team_invitations drop constraint if exists residence_team_invitations_permissions_check;
alter table public.residence_team_invitations add constraint residence_team_invitations_permissions_check
  check (jsonb_typeof(permissions) = 'object');

-- ==== 1b. residence_users.permissions: siempre un objeto jsonb (DR11) ====
-- `permissions` es `jsonb not null default '{}'` desde la 0003 y el código nunca guarda otra cosa que un objeto, pero nada lo impedía a nivel base.
-- `not valid` no revisa las filas existentes (no puede romper la migración); después se valida solo si ninguna fila la viola.
alter table public.residence_users drop constraint if exists residence_users_permissions_object_check;
alter table public.residence_users add constraint residence_users_permissions_object_check
  check (jsonb_typeof(permissions) = 'object') not valid;
do $$
begin
  if exists (select 1 from public.residence_users where jsonb_typeof(permissions) <> 'object') then
    raise notice '0051: hay filas de residence_users con permissions que no es un objeto: la restricción queda NOT VALID (rige solo para filas nuevas o modificadas). El código las trata como "sin permisos". Corregilas y corré: alter table public.residence_users validate constraint residence_users_permissions_object_check;';
  else
    alter table public.residence_users validate constraint residence_users_permissions_object_check;
  end if;
end
$$;

-- ==== 2. Índices ====
create unique index if not exists residence_team_invitations_token_hash_key
  on public.residence_team_invitations (token_hash);
create unique index if not exists residence_team_invitations_one_pending_per_email
  on public.residence_team_invitations (residence_id, lower(email)) where status = 'pending';
create index if not exists residence_team_invitations_residence_idx
  on public.residence_team_invitations (residence_id, created_at desc);

-- ==== 3. RLS sin policies para usuarios + sin privilegios para anon/authenticated ====
alter table public.residence_team_invitations enable row level security;
revoke all on public.residence_team_invitations from anon, authenticated;

comment on table public.residence_team_invitations is
  'Invitación por email a un staff de una residencia (DR10). Token de un solo uso guardado hasheado, vence a los 7 días. No crea residence_users hasta que se acepta; el rol siempre es staff. Lectura y escritura solo con service role.';
comment on column public.residence_team_invitations.permissions is
  'Permisos iniciales del staff elegidos por el dueño al invitar (DR11). Al aceptar se copian a residence_users.permissions. El rol nunca sale de acá: siempre staff.';
comment on column public.residence_team_invitations.token_hash is
  'SHA-256 (hex) del token del enlace /register/staff/[token]. El token en claro nunca se guarda.';

commit;

-- Verificación (descomentar y correr aparte):
-- 1) La tabla existe, vacía, con RLS activa y sin policies (esperado: relrowsecurity = true y 0 filas en la 2.ª query):
--   select relname, relrowsecurity from pg_class where oid = 'public.residence_team_invitations'::regclass;
--   select policyname from pg_policies where schemaname = 'public' and tablename = 'residence_team_invitations';
-- 2) anon / authenticated no tienen ningún privilegio de tabla (esperado: 0 filas):
--   select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema = 'public' and table_name = 'residence_team_invitations' and grantee in ('anon', 'authenticated');
-- 3) Índices (esperado: 4 filas — pkey, token_hash_key, one_pending_per_email y residence_idx):
--   select indexname from pg_indexes where schemaname = 'public' and tablename = 'residence_team_invitations';
-- 3b) Las dos FK de invited_by y accepted_by_user_id son `on delete set null` (esperado: confdeltype = 'n' en las 2 filas) y `invited_by` es nullable (esperado: is_nullable = 'YES'):
--   select conname, confdeltype from pg_constraint
--     where conrelid = 'public.residence_team_invitations'::regclass and contype = 'f' and conname in ('residence_team_invitations_invited_by_fkey', 'residence_team_invitations_accepted_by_user_id_fkey');
--   select column_name, is_nullable from information_schema.columns
--     where table_schema = 'public' and table_name = 'residence_team_invitations' and column_name = 'invited_by';
-- 3c) La restricción de residence_users.permissions existe y está validada (esperado: convalidated = true; si es false, la notice del aviso dice por qué):
--   select conname, convalidated from pg_constraint where conrelid = 'public.residence_users'::regclass and conname = 'residence_users_permissions_object_check';
--   select id, permissions from public.residence_users where jsonb_typeof(permissions) <> 'object';  -- esperado: 0 filas
-- 4) Una invitación no puede crear un dueño (esperado: error de CHECK al correr este insert de prueba dentro de una transacción que se revierte):
--   begin;
--   insert into public.residence_team_invitations (residence_id, email, role, token_hash, invited_by, expires_at)
--     select r.id, 'prueba@example.com', 'owner', repeat('a', 64), u.id, now() + interval '7 days'
--     from public.residences r, public.users u limit 1;
--   rollback;
-- Por API (JWT de cualquier usuario): GET /rest/v1/residence_team_invitations → 401/403 "permission denied for table"

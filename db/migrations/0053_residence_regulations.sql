-- EstuRed — Migración 0053: reglamento de la residencia con versiones y aceptación al solicitar (DR14, fase 2a)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Es ADITIVA e IDEMPOTENTE (create ... if not exists, drop/create de policies y triggers, add column if not exists) y no modifica
--    ninguna fila existente ni cambia los estados de `application_requests`.
--    Necesita: `residences`, `users`, `application_requests`, `student_profiles`, `residence_users` (0002/0003/0007) y la función
--    `is_family_member_of_student` (0006/0046).
--    Hasta que se aplique, el código degrada con gracia: la ficha muestra el reglamento MODELO (sin versiones), la pantalla del reglamento
--    de la residencia avisa que todavía no se puede publicar, y la solicitud se envía igual (sin guardar la aceptación; el checkbox
--    sigue siendo obligatorio en la pantalla).
--
-- MOTIVO. docs/00 §31 DR14 (1), docs/06 §8.7 y §11.5, docs/05 §16bis: el estudiante lee el reglamento completo y lo ACEPTA al enviar la
-- solicitud; la aceptación se guarda por solicitud con versión/hash y fecha; los cambios posteriores no afectan lo ya aceptado; sin
-- revisión del admin (decisión del dueño 2026-10-25).
--
-- QUÉ HACE
--   1. `residence_regulation_versions`: una fila por versión (correlativa por residencia). `status` draft|published|superseded; `source`
--      own|model; `content` jsonb (hoy `{ "text": "..." }`); `content_hash` SHA-256 hex. Inmutable una vez publicada (trigger: solo pueden
--      cambiar `status` y `published_at`). Una sola `published` por residencia (índice único parcial).
--   2. `application_regulation_acceptances`: una por solicitud (unique), inmutable (trigger bloquea UPDATE; no hay policies de escritura).
--      DELETE solo por service role y únicamente para limpieza/cascada (borrar la solicitud o la residencia).
--   3. `residences.current_regulation_version_id` (puntero a la versión publicada; null = rige el modelo), FK `on delete set null`.
--   4. RLS. Versiones: lectura PÚBLICA solo de la `published` de una residencia `verified_active`; el equipo de la residencia lee todas las
--      suyas; quien aceptó una versión puede seguir leyéndola aunque haya sido reemplazada. Escritura: solo service role.
--      Aceptaciones: solo lectura del estudiante, de su familiar vinculado y del equipo de la residencia dueña (función SECURITY DEFINER,
--      para no recursar con las policies de `application_requests`); admin/superadmin leen con service role.
--   5. Grants: ni `anon` ni `authenticated` leen las aceptaciones; de las versiones solo ven las columnas públicas (no `created_by_user_id` ni `file_id`).
--   6. `application_requests.regulation_acceptance_pending` (boolean, default false): marca las solicitudes que se crearon SIN aceptación del reglamento
--      (propuesta del familiar aprobada, activación desde la lista de espera, estudiante menor, o aceptación que no se pudo registrar). NO es un estado de
--      la solicitud (docs/04 no cambia). Mientras esté en true y no exista la fila de aceptación, la residencia no puede avanzar la solicitud (contactar,
--      proponer ajuste, habilitar o confirmar el pago). Las solicitudes anteriores a esta migración quedan en false (no se bloquean).
--   7. Funciones `publish_residence_regulation` y `ensure_model_regulation_version` (SECURITY DEFINER, search_path fijo, solo service_role): publican de forma
--      ATÓMICA (bloquean la fila de la residencia, reemplazan la vigente y crean la nueva en una sola transacción; sin carrera con la versión del modelo).
--
-- REVERTIR (borra reglamentos y aceptaciones; el código vuelve a degradar con gracia):
--   alter table public.residences drop column if exists current_regulation_version_id;
--   drop table if exists public.application_regulation_acceptances;
--   drop table if exists public.residence_regulation_versions;
--   drop function if exists public.can_read_application_acceptance(uuid);
--   drop function if exists public.regulation_version_accepted_by_reader(uuid);
--   drop function if exists public.publish_residence_regulation(uuid, uuid, text, text, jsonb, text);
--   drop function if exists public.ensure_model_regulation_version(uuid, text, jsonb, text);
--   alter table public.application_requests drop column if exists regulation_acceptance_pending;

begin;

-- ==== 0. Guarda ====
do $$
begin
  if to_regclass('public.residences') is null
     or to_regclass('public.users') is null
     or to_regclass('public.residence_users') is null
     or to_regclass('public.application_requests') is null
     or to_regclass('public.student_profiles') is null then
    raise exception '0053: faltan residences / users / residence_users / application_requests / student_profiles (migraciones 0002, 0003 y 0007)';
  end if;
  if to_regprocedure('public.is_family_member_of_student(uuid)') is null then
    raise exception '0053: falta la función is_family_member_of_student (migraciones 0006/0046)';
  end if;
end
$$;

-- ==== 1. Versiones del reglamento ====
create table if not exists public.residence_regulation_versions (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  source text not null check (source in ('own', 'model')),
  model_version text,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  file_id uuid references public.files (id) on delete set null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded')),
  published_at timestamptz,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint residence_regulation_versions_number_unique unique (residence_id, version_number),
  constraint residence_regulation_versions_published_has_date check (status = 'draft' or published_at is not null)
);

-- Una sola versión publicada por residencia.
create unique index if not exists residence_regulation_versions_one_published
  on public.residence_regulation_versions (residence_id) where status = 'published';
create index if not exists residence_regulation_versions_residence_idx
  on public.residence_regulation_versions (residence_id, version_number desc);

-- Inmutable una vez publicada: solo cambian `status` (published → superseded) y `published_at`.
create or replace function public.residence_regulation_versions_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('published', 'superseded') and (
       new.residence_id is distinct from old.residence_id
    or new.version_number is distinct from old.version_number
    or new.source is distinct from old.source
    or new.model_version is distinct from old.model_version
    or new.content is distinct from old.content
    or new.file_id is distinct from old.file_id
    or new.content_hash is distinct from old.content_hash
    or new.created_by_user_id is distinct from old.created_by_user_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Una versión publicada del reglamento no se edita: se crea una versión nueva.';
  end if;
  if old.status = 'superseded' and new.status is distinct from old.status then
    raise exception 'Una versión reemplazada no vuelve a publicarse.';
  end if;
  return new;
end
$$;

drop trigger if exists residence_regulation_versions_immutable on public.residence_regulation_versions;
create trigger residence_regulation_versions_immutable
  before update on public.residence_regulation_versions
  for each row execute function public.residence_regulation_versions_immutable();

-- ==== 2. Aceptaciones por solicitud ====
create table if not exists public.application_regulation_acceptances (
  id uuid primary key default gen_random_uuid(),
  application_request_id uuid not null unique references public.application_requests (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  regulation_version_id uuid not null references public.residence_regulation_versions (id),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  accepted_by_user_id uuid references public.users (id) on delete set null,
  accepted_by_role text not null check (accepted_by_role in ('student', 'guardian'))
);
create index if not exists application_regulation_acceptances_residence_idx
  on public.application_regulation_acceptances (residence_id);
create index if not exists application_regulation_acceptances_version_idx
  on public.application_regulation_acceptances (regulation_version_id);

-- Inmutable: ninguna columna se modifica jamás (las filas siguen apuntando a la versión aceptada).
create or replace function public.application_regulation_acceptances_no_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'La aceptación del reglamento no se edita.';
end
$$;

drop trigger if exists application_regulation_acceptances_no_update on public.application_regulation_acceptances;
create trigger application_regulation_acceptances_no_update
  before update on public.application_regulation_acceptances
  for each row execute function public.application_regulation_acceptances_no_update();

-- ==== 3. Puntero a la versión vigente ====
alter table public.residences
  add column if not exists current_regulation_version_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'residences_current_regulation_version_fk'
  ) then
    alter table public.residences
      add constraint residences_current_regulation_version_fk
      foreign key (current_regulation_version_id)
      references public.residence_regulation_versions (id) on delete set null;
  end if;
end
$$;

comment on column public.residences.current_regulation_version_id is 'DR14: versión PUBLICADA del reglamento (null = rige el modelo). La mantiene el servidor al publicar.';

-- Solicitudes creadas sin aceptación del reglamento (no es un estado: docs/04 no cambia). Las existentes quedan en false.
alter table public.application_requests
  add column if not exists regulation_acceptance_pending boolean not null default false;
comment on column public.application_requests.regulation_acceptance_pending is 'DR14: true = la solicitud se creó sin aceptar el reglamento; mientras falte la fila de aceptación la residencia no puede avanzarla.';

-- ==== 4. Funciones SECURITY DEFINER (evitan recursión de RLS entre policies cruzadas) ====
-- ¿El usuario autenticado puede leer la aceptación de esta solicitud? Estudiante dueño, familiar vinculado activo o equipo activo de la residencia.
create or replace function public.can_read_application_acceptance(p_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.application_requests ar
    where ar.id = p_application_id
      and (
        ar.student_profile_id in (select sp.id from public.student_profiles sp where sp.user_id = auth.uid())
        or public.is_family_member_of_student(ar.student_profile_id)
        or ar.residence_id in (
          select ru.residence_id from public.residence_users ru
          where ru.user_id = auth.uid() and ru.is_active = true
        )
      )
  );
$$;

-- ¿El usuario autenticado aceptó (o es familiar/equipo de una solicitud que aceptó) esta versión? Le permite seguir leyéndola si fue reemplazada.
create or replace function public.regulation_version_accepted_by_reader(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.application_regulation_acceptances a
    where a.regulation_version_id = p_version_id
      and public.can_read_application_acceptance(a.application_request_id)
  );
$$;

revoke all on function public.can_read_application_acceptance(uuid) from public, anon;
revoke all on function public.regulation_version_accepted_by_reader(uuid) from public, anon;
grant execute on function public.can_read_application_acceptance(uuid) to authenticated;
grant execute on function public.regulation_version_accepted_by_reader(uuid) to authenticated;

-- ==== 4b. Publicación atómica (solo service role) ====
-- Publica una versión nueva: bloquea la fila de la residencia (serializa publicaciones y la creación de la versión del modelo), reemplaza la
-- vigente y crea la nueva, todo en una transacción. Errores: 'no_changes' (mismo hash que la vigente), 'residence_not_found'.
create or replace function public.publish_residence_regulation(
  p_residence_id uuid,
  p_actor_user_id uuid,
  p_source text,
  p_model_version text,
  p_content jsonb,
  p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current record;
  v_next integer;
  v_id uuid;
begin
  perform 1 from public.residences where id = p_residence_id for update;
  if not found then
    raise exception 'residence_not_found';
  end if;

  select id, version_number, content_hash into v_current
  from public.residence_regulation_versions
  where residence_id = p_residence_id and status = 'published';

  if v_current.id is not null and v_current.content_hash = p_hash then
    raise exception 'no_changes';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.residence_regulation_versions where residence_id = p_residence_id;

  if v_current.id is not null then
    update public.residence_regulation_versions set status = 'superseded' where id = v_current.id;
  end if;

  insert into public.residence_regulation_versions
    (residence_id, version_number, source, model_version, content, content_hash, status, published_at, created_by_user_id)
  values
    (p_residence_id, v_next, p_source, p_model_version, p_content, p_hash, 'published', now(), p_actor_user_id)
  returning id into v_id;

  update public.residences set current_regulation_version_id = v_id where id = p_residence_id;

  return jsonb_build_object(
    'id', v_id,
    'version_number', v_next,
    'previous_version_number', v_current.version_number,
    'previous_hash', v_current.content_hash
  );
end
$$;

-- La residencia no tiene reglamento propio: devuelve (o crea una sola vez) la versión que contiene el MODELO base, para poder referenciarla en
-- la aceptación. Si la vigente es un modelo base con otro texto (el modelo cambió), la reemplaza. Si ya hay una vigente propia, la devuelve tal cual
-- (el llamador compara el hash que vio el estudiante con el devuelto).
create or replace function public.ensure_model_regulation_version(
  p_residence_id uuid,
  p_model_version text,
  p_content jsonb,
  p_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current record;
  v_next integer;
  v_id uuid;
begin
  perform 1 from public.residences where id = p_residence_id for update;
  if not found then
    raise exception 'residence_not_found';
  end if;

  select id, source, content, content_hash into v_current
  from public.residence_regulation_versions
  where residence_id = p_residence_id and status = 'published';

  if v_current.id is not null then
    if v_current.source = 'model'
       and coalesce((v_current.content ->> 'base_model')::boolean, false)
       and v_current.content_hash <> p_hash then
      update public.residence_regulation_versions set status = 'superseded' where id = v_current.id;
    else
      return jsonb_build_object('id', v_current.id, 'content_hash', v_current.content_hash);
    end if;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.residence_regulation_versions where residence_id = p_residence_id;

  insert into public.residence_regulation_versions
    (residence_id, version_number, source, model_version, content, content_hash, status, published_at, created_by_user_id)
  values
    (p_residence_id, v_next, 'model', p_model_version, p_content, p_hash, 'published', now(), null)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'content_hash', p_hash);
end
$$;

revoke all on function public.publish_residence_regulation(uuid, uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.ensure_model_regulation_version(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.publish_residence_regulation(uuid, uuid, text, text, jsonb, text) to service_role;
grant execute on function public.ensure_model_regulation_version(uuid, text, jsonb, text) to service_role;

-- ==== 5. RLS ====
alter table public.residence_regulation_versions enable row level security;

drop policy if exists regulation_versions_select_public on public.residence_regulation_versions;
create policy regulation_versions_select_public on public.residence_regulation_versions
  for select to anon, authenticated using (
    status = 'published' and residence_id in (
      select id from public.residences where status = 'verified_active'
    )
  );

drop policy if exists regulation_versions_select_own on public.residence_regulation_versions;
create policy regulation_versions_select_own on public.residence_regulation_versions
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

drop policy if exists regulation_versions_select_accepted on public.residence_regulation_versions;
create policy regulation_versions_select_accepted on public.residence_regulation_versions
  for select to authenticated using (public.regulation_version_accepted_by_reader(id));

alter table public.application_regulation_acceptances enable row level security;

drop policy if exists regulation_acceptances_select_related on public.application_regulation_acceptances;
create policy regulation_acceptances_select_related on public.application_regulation_acceptances
  for select to authenticated using (public.can_read_application_acceptance(application_request_id));

-- Sin policies de INSERT/UPDATE/DELETE: solo el service role escribe (server actions).

-- ==== 6. Grants ====
-- Aceptaciones: solo se leen vía RLS por el propio estudiante / familia / equipo (rol authenticated); anon nada. Nadie escribe salvo service role.
revoke all on public.application_regulation_acceptances from anon;
revoke insert, update, delete on public.application_regulation_acceptances from authenticated;
-- Versiones: sin escritura para la API; la lectura es POR COLUMNAS (no se expone el autor ni el archivo) tanto a anon como a authenticated.
revoke all on public.residence_regulation_versions from anon, authenticated;
grant select (id, residence_id, version_number, source, model_version, content, content_hash, status, published_at, created_at)
  on public.residence_regulation_versions to anon, authenticated;

commit;

-- EstuRed — Migración 0095: mensaje de WhatsApp editable de cada residencia («Compartir tu ficha»)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. ADITIVA e IDEMPOTENTE; no toca filas existentes. Necesita: `residences` (0003),
--    `users` (0002), `residence_users` (0003), `set_updated_at()` y `is_active_user()` (0081).
--    Hasta que se aplique, el código degrada con gracia: `/residence/<id>/share` muestra el mensaje original (el que trae EstuRed), se puede
--    compartir por WhatsApp y copiar, pero «Guardar» avisa que todavía no está disponible.
--
-- MOTIVO. Propuesta A de la ficha (design-proposals/ficha-presentacion/propuesta-a/SPEC.md, «Datos nuevos» 1). Cada residencia puede
-- guardar su propia versión del mensaje con el que comparte su ficha por WhatsApp (botón manual `wa.me`, sin API de WhatsApp Business) y
-- volver al original. Si no hay fila, se usa la plantilla por defecto (vive en el código: `lib/share/resolveShareMessage.ts`).
--
-- QUÉ HACE
--   1. `residence_share_messages`: una fila por residencia (PK = residence_id), `template` con placeholders `{LINK}`, `{PRICE_FROM}`, etc.
--      CHECK de red de seguridad: 1 a 1000 caracteres y contiene `{LINK}` (las reglas completas —solo placeholders conocidos— se validan en el servidor).
--   2. RLS: lectura solo para miembros ACTIVOS de la residencia (dueño o staff, cualquier permiso: el staff sin permiso de perfil ve y comparte,
--      no edita). Sin policies de escritura: guarda solo el service role desde la server action (permiso `profile.edit`).
--      Policy RESTRICTIVE `residence_share_messages_only_active_users` (regla 0081). La pertenencia se resuelve con una función
--      SECURITY DEFINER para no recursar RLS con `residence_users`.
--   3. Grants por columna (gotcha 0081): `select` solo a `authenticated` y sin escritura (0090). Nada para `anon`: no es público.
--
-- REVERTIR:
--   drop table if exists public.residence_share_messages;
--   drop function if exists public.is_active_residence_member(uuid);

begin;

do $$
begin
  if to_regclass('public.residences') is null or to_regclass('public.users') is null or to_regclass('public.residence_users') is null then
    raise exception '0095: faltan residences / users / residence_users';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0095: falta la función set_updated_at';
  end if;
  if to_regprocedure('public.is_active_user()') is null then
    raise exception '0095: falta la función is_active_user (migración 0081)';
  end if;
end
$$;

-- ==== 1. Pertenencia (SECURITY DEFINER: evita recursión de RLS con residence_users) ====
create or replace function public.is_active_residence_member(p_residence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.residence_users ru
    where ru.residence_id = p_residence_id and ru.user_id = auth.uid() and ru.is_active
  );
$$;

revoke all on function public.is_active_residence_member(uuid) from public, anon;
grant execute on function public.is_active_residence_member(uuid) to authenticated;

-- ==== 2. Tabla ====
create table if not exists public.residence_share_messages (
  residence_id uuid primary key references public.residences (id) on delete cascade,
  template text not null check (char_length(template) between 1 and 1000 and position('{LINK}' in template) > 0),
  updated_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists residence_share_messages_updated_at on public.residence_share_messages;
create trigger residence_share_messages_updated_at before update on public.residence_share_messages
  for each row execute function public.set_updated_at();

comment on table public.residence_share_messages is
  'Mensaje de WhatsApp editable por residencia (plantilla con placeholders). Sin fila = plantilla por defecto del código. Escribe solo el service role (permiso profile.edit validado en el servidor).';

-- ==== 3. RLS ====
alter table public.residence_share_messages enable row level security;

drop policy if exists residence_share_messages_select_members on public.residence_share_messages;
create policy residence_share_messages_select_members on public.residence_share_messages
  for select to authenticated using ((select public.is_active_residence_member(residence_id)));

drop policy if exists residence_share_messages_only_active_users on public.residence_share_messages;
create policy residence_share_messages_only_active_users on public.residence_share_messages
  as restrictive for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

-- ==== 4. Grants ====
revoke all on public.residence_share_messages from anon, authenticated;
grant select (residence_id, template, updated_by_user_id, created_at, updated_at) on public.residence_share_messages to authenticated;

commit;

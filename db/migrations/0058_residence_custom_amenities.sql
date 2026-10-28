-- EstuRed — Migración 0058: ítems «Otro» de servicios y áreas comunes con aprobación del admin (DR18, fase 2)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE; no toca filas existentes. Necesita: `residences`, `residence_users`, `users` y `set_updated_at()`.
--    Hasta que se aplique, el código degrada con gracia: la ficha de edición avisa que los ítems propios no están disponibles y la ficha
--    pública muestra solo las opciones fijas.
--
-- QUÉ HACE
--   1. `residence_custom_amenities`: ítem propio (kind service|area, label corto) con status pending|approved|rejected, reviewed_by/at y
--      reject_reason (obligatorio si se rechaza). Único por (residencia, tipo, texto sin mayúsculas).
--   2. RLS fail-closed: el equipo activo de la residencia lee los suyos (función SECURITY DEFINER, sin recursión); el público lee SOLO los
--      aprobados de residencias verified_active. Sin policies de escritura: crea y cambia estado solo el service role (server actions
--      con validación del texto y control de permiso `profile.edit`; aprobar/rechazar, solo admin).
--
-- REVERTIR: drop table if exists public.residence_custom_amenities; drop function if exists public.is_residence_team_member(uuid);

begin;

do $$
begin
  if to_regclass('public.residences') is null or to_regclass('public.residence_users') is null then
    raise exception '0058: faltan residences / residence_users';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0058: falta la función set_updated_at (migración 0002/0039)';
  end if;
end
$$;

create or replace function public.is_residence_team_member(p_residence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.residence_users ru
    where ru.residence_id = p_residence_id and ru.user_id = auth.uid() and ru.is_active = true
  );
$$;
revoke all on function public.is_residence_team_member(uuid) from public, anon;
grant execute on function public.is_residence_team_member(uuid) to authenticated, service_role;

create table if not exists public.residence_custom_amenities (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  kind text not null check (kind in ('service', 'area')),
  label text not null check (char_length(btrim(label)) between 3 and 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_by uuid references public.users (id) on delete set null,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_amenities_reject_reason_required check (status <> 'rejected' or char_length(btrim(coalesce(reject_reason, ''))) > 0)
);

create unique index if not exists residence_custom_amenities_unique_label
  on public.residence_custom_amenities (residence_id, kind, lower(btrim(label)));
create index if not exists residence_custom_amenities_pending_idx
  on public.residence_custom_amenities (created_at) where status = 'pending';

drop trigger if exists residence_custom_amenities_updated_at on public.residence_custom_amenities;
create trigger residence_custom_amenities_updated_at before update on public.residence_custom_amenities
  for each row execute function public.set_updated_at();

alter table public.residence_custom_amenities enable row level security;

drop policy if exists custom_amenities_select_team on public.residence_custom_amenities;
create policy custom_amenities_select_team on public.residence_custom_amenities
  for select to authenticated using (public.is_residence_team_member(residence_id));

drop policy if exists custom_amenities_select_public on public.residence_custom_amenities;
create policy custom_amenities_select_public on public.residence_custom_amenities
  for select to anon, authenticated using (
    status = 'approved' and residence_id in (select id from public.residences where status = 'verified_active')
  );

-- Solo columnas públicas: created_by / reviewed_by / reject_reason no se exponen por la API. El código lee todo con el service role.
revoke all on public.residence_custom_amenities from anon, authenticated;
grant select (id, residence_id, kind, label, status) on public.residence_custom_amenities to anon, authenticated;

commit;

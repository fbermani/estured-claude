-- EstuRed — Migración 0059: clasificación de fotos de residencia (galería por área / tipo de habitación + destacadas) (DR18, fase 2, tanda 2)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE; no toca filas existentes ni `files`. Necesita: `files`, `residences`, `room_types` y `set_updated_at()`.
--    Hasta que se aplique, el código degrada con gracia: toda foto se lee como «general», sin destacadas, y el editor avisa que
--    la clasificación no está disponible.
--
-- QUÉ HACE
--   1. `residence_photo_meta`: una fila por foto (file_id PK → files) con categoría general | area | room_type, área (solo si area),
--      tipo de habitación (solo si room_type), `is_featured` (las que rotan en el hero/tarjeta; el tope de 5 lo valida el servidor)
--      . Sin fila = foto «general» no destacada.
--   2. RLS sin policies (mismo patrón que `files`): solo el service role lee/escribe, desde server actions con control de permiso
--      `profile.edit`. Se revocan los grants de anon/authenticated. No hay funciones SECURITY DEFINER.
--
-- REVERTIR: drop table if exists public.residence_photo_meta;

begin;

do $$
begin
  if to_regclass('public.files') is null or to_regclass('public.residences') is null or to_regclass('public.room_types') is null then
    raise exception '0059: faltan files / residences / room_types';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0059: falta la función set_updated_at';
  end if;
end
$$;

create table if not exists public.residence_photo_meta (
  file_id uuid primary key references public.files (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  category text not null default 'general' check (category in ('general', 'area', 'room_type')),
  area text check (area is null or area in (
    'cocina', 'bano', 'patio', 'terraza', 'comedor', 'living', 'lavadero', 'gimnasio', 'estudio', 'entrada', 'otra'
  )),
  room_type_id uuid references public.room_types (id) on delete set null,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_meta_area_only_for_area check (category = 'area' or area is null),
  constraint photo_meta_area_required check (category <> 'area' or area is not null),
  constraint photo_meta_room_type_only_for_room_type check (category = 'room_type' or room_type_id is null)
);

drop trigger if exists residence_photo_meta_updated_at on public.residence_photo_meta;
create trigger residence_photo_meta_updated_at before update on public.residence_photo_meta
  for each row execute function public.set_updated_at();

create index if not exists residence_photo_meta_residence_idx on public.residence_photo_meta (residence_id);

alter table public.residence_photo_meta enable row level security;
revoke all on public.residence_photo_meta from anon, authenticated;

comment on table public.residence_photo_meta is 'Clasificación de fotos de residencia (DR18). RLS sin policies: solo service role.';

commit;

-- EstuRed — Migración 0097: foto de portada principal de la residencia (`is_cover`)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. ADITIVA e IDEMPOTENTE; no toca filas existentes. Necesita: `residence_photo_meta` (0059).
--    Hasta que se aplique, el código degrada con gracia: la portada del hero y de la imagen de vista previa sigue siendo la primera de las
--    fotos que rotan (`cover_order`, 0074) y el editor no ofrece «Usar como portada».
--
-- MOTIVO. Propuesta A de la ficha (SPEC, «Datos nuevos» 3): la residencia elige UNA foto como portada del hero y de la vista previa del link.
-- Es independiente de las hasta 5 «de rotación» (`is_featured` + `cover_order`): la portada va primero en la rotación aunque no esté entre ellas.
--
-- QUÉ HACE
--   1. `residence_photo_meta.is_cover boolean not null default false`.
--   2. Índice único parcial: una sola portada por residencia (`unique (residence_id) where is_cover`).
--   Sin cambios de RLS ni de grants: la tabla sigue sin policies (solo service role, con permiso `profile.edit` validado en el servidor).
--
-- REVERTIR: drop index if exists public.residence_photo_meta_one_cover_idx; alter table public.residence_photo_meta drop column if exists is_cover;

begin;

do $$
begin
  if to_regclass('public.residence_photo_meta') is null then
    raise exception '0097: falta residence_photo_meta (migración 0059)';
  end if;
end
$$;

alter table public.residence_photo_meta add column if not exists is_cover boolean not null default false;

create unique index if not exists residence_photo_meta_one_cover_idx
  on public.residence_photo_meta (residence_id) where is_cover;

comment on column public.residence_photo_meta.is_cover is 'Portada principal (una por residencia): hero de la ficha e imagen de vista previa del link.';

commit;

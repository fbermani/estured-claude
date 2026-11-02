-- EstuRed — Migración 0070: fotos por sección con nombre en la galería «Ver todas» (DR30, punto 1)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE; no toca filas existentes. Necesita: `residence_photo_meta` (migración 0059).
--    Hasta que se aplique, el código degrada con gracia: las fotos se agrupan por área / tipo de habitación como en DR18 y el
--    editor no ofrece secciones.
--
-- QUÉ HACE
--   1. `residence_photo_meta.section`: nombre libre de la sección (Living, Cocina completa, Dormitorio 1…), 1–40 caracteres.
--      null = se usa el área / tipo de habitación como sugerencia o, si no hay, «Fotos adicionales».
--   2. `residence_photo_meta.sort_order`: orden de la foto dentro de la galería (0 por defecto).
--   Sin cambios de RLS: la tabla sigue sin policies (solo service role, con permiso `profile.edit` validado en el servidor).
--
-- REVERTIR: alter table public.residence_photo_meta drop column if exists section, drop column if exists sort_order;

begin;

do $$
begin
  if to_regclass('public.residence_photo_meta') is null then
    raise exception '0070: falta residence_photo_meta (migración 0059)';
  end if;
end
$$;

alter table public.residence_photo_meta add column if not exists section text;
alter table public.residence_photo_meta add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'photo_meta_section_length' and conrelid = 'public.residence_photo_meta'::regclass) then
    alter table public.residence_photo_meta
      add constraint photo_meta_section_length check (section is null or char_length(section) between 1 and 40);
  end if;
end
$$;

comment on column public.residence_photo_meta.section is 'Sección con nombre de la galería (DR30). null = sugerida por área / tipo o «Fotos adicionales».';

commit;

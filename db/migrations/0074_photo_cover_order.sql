-- EstuRed — Migración 0074: orden de las fotos de portada (las que rotan en la ficha y la tarjeta)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. ADITIVA e IDEMPOTENTE; no toca filas existentes. Necesita: `residence_photo_meta` (migración 0059).
--    Hasta que se aplique, el código degrada con gracia: las destacadas se siguen eligiendo (hasta 5) pero rotan en el orden de la galería
--    (`sort_order`, migración 0070) en vez de en el orden que elija el owner, y el editor no ofrece mover la portada.
--
-- QUÉ HACE
--   1. `residence_photo_meta.cover_order`: posición (1 a 5) de la foto dentro de las de portada. Solo tiene sentido con `is_featured = true`;
--      null = sin orden elegido (rota según `sort_order`). El servidor lo normaliza (1..N sin repetidos) al guardar.
--   Sin cambios de RLS ni de grants: la tabla sigue sin policies (solo service role, con permiso `profile.edit` validado en el servidor).
--
-- REVERTIR: alter table public.residence_photo_meta drop constraint if exists photo_meta_cover_order_range, drop column if exists cover_order;

alter table public.residence_photo_meta add column if not exists cover_order smallint;

alter table public.residence_photo_meta drop constraint if exists photo_meta_cover_order_range;
alter table public.residence_photo_meta
  add constraint photo_meta_cover_order_range check (cover_order is null or cover_order between 1 and 5);

comment on column public.residence_photo_meta.cover_order is 'Orden (1 a 5) de las fotos de portada dentro de las destacadas. null = según sort_order.';

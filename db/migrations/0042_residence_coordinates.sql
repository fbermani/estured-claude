-- EstuRed — Migración 0042: coordenada por residencia para el mapa de la ficha (hallazgo D19)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado).
--
-- MOTIVO. El mapa de la ficha (`/residencias/[slug]`) muestra el PIN de la residencia y, alrededor, las
-- universidades cercanas con su distancia. Hace falta una coordenada por residencia.
--
-- DECISIÓN DEL DUEÑO (2026-10-23, reemplaza DF3/DF4). La dirección y la ubicación de una residencia son
-- información PÚBLICA (cualquiera las encuentra online): no se ocultan ni se aproximan. Por eso se guarda la
-- coordenada EXACTA y la ficha muestra el pin exacto y la dirección. (Una versión previa de esta migración
-- forzaba 3 decimales con un CHECK; se quitó antes de aplicarse.)
--
-- CAMBIO (aditivo, no destructivo).
--   - residences.latitude / residences.longitude: numeric(9,6), nulas. Sin coordenada, la ficha cae al centro
--     del barrio (`lib/data/caBarrioCentroids.ts`) y lo dice ("ubicación aproximada: barrio"), sin pin exacto.
--   - CHECK de rango (-90..90 / -180..180) y de coherencia (ambas o ninguna).
--   - Sin policies nuevas: las columnas heredan las de `residences` (lectura pública de las verificadas).
--   - Carga: solo el admin, en `/admin/residences/[id]` (server action con `requireAdmin` + auditoría).
--
-- REVERTIR: `alter table residences drop column latitude, drop column longitude;` (la ficha vuelve al centro
-- del barrio; no hay otra dependencia).

alter table public.residences
  add column if not exists latitude numeric(9, 6),
  add column if not exists longitude numeric(9, 6);

alter table public.residences drop constraint if exists residences_latitude_range;
alter table public.residences add constraint residences_latitude_range
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table public.residences drop constraint if exists residences_longitude_range;
alter table public.residences add constraint residences_longitude_range
  check (longitude is null or (longitude >= -180 and longitude <= 180));

alter table public.residences drop constraint if exists residences_coordinates_pair;
alter table public.residences add constraint residences_coordinates_pair
  check ((latitude is null) = (longitude is null));

-- Por si una versión previa de esta migración se aplicó en algún entorno.
alter table public.residences drop constraint if exists residences_coordinates_approximate;

comment on column public.residences.latitude is
  'D19: latitud de la residencia para el pin del mapa público (la ubicación es pública).';
comment on column public.residences.longitude is
  'D19: longitud de la residencia para el pin del mapa público.';

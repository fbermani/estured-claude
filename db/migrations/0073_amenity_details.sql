-- EstuRed — Migración 0073: detalles de servicios y áreas (cocinas compartidas, frecuencia de limpieza) y reubicación de «Gimnasio» / «Cocina»
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. Es ADITIVA e IDEMPOTENTE (add column if not exists + movimientos que, si se corren de nuevo, no encuentran nada).
--    Hasta que se aplique, el código degrada con gracia: la ficha y el formulario normalizan «Gimnasio»/«Cocina» al leer (se muestran como áreas comunes),
--    y la cantidad de cocinas / frecuencia de limpieza no se guarda (el formulario avisa al guardar).
--
-- MOTIVO (decisión del dueño, 2026-11-03).
--   1. «Gimnasio / Área para ejercitar» deja de ser un servicio y pasa a las áreas comunes. El valor guardado sigue siendo «Gimnasio».
--   2. «Cocina compartida» es un área común nueva, con cantidad de cocinas (1 a 5). Reemplaza al servicio «Cocina».
--   3. «Limpieza General» (servicio) lleva una frecuencia: «Todos los días» o «N veces por semana» (1 a 6).
--
-- QUÉ HACE
--   a. `residences.amenity_details` (jsonb, default '{}', siempre objeto). Forma:
--        { "kitchens": 2, "cleaning_general": { "mode": "daily" } | { "mode": "weekly", "per_week": 3 } }
--      Se valida server-side (whitelist + rangos) en `lib/residences/amenityDetails.ts`. Sin grants nuevos: `residences` no tiene SELECT por columna.
--   b. Mueve «Gimnasio» de `residence_profile_sections.services` a `common_areas` (crea la sección de áreas si no existía; sin repetidos).
--   c. Decisión simple para «Cocina»: toda residencia con «Cocina» en servicios pasa a tener «Cocina compartida» en áreas comunes
--      y `amenity_details.kitchens = 1` (si no tenía ya una cantidad). Se quita «Cocina» de servicios.
--      Las ediciones pendientes de revisión (`residence_profile_edits`, grupo `services`) no se tocan: la app normaliza al leer.
--   d. «Limpieza General» queda sin frecuencia hasta que la residencia la elija (la ficha muestra solo «Limpieza General»).
--
-- REVERTIR (la columna y sus datos; los ítems movidos no se devuelven solos):
--   alter table public.residences drop constraint if exists residences_amenity_details_object_check;
--   alter table public.residences drop column if exists amenity_details;

alter table public.residences add column if not exists amenity_details jsonb not null default '{}'::jsonb;

alter table public.residences drop constraint if exists residences_amenity_details_object_check;
alter table public.residences add constraint residences_amenity_details_object_check check (jsonb_typeof(amenity_details) = 'object');

-- c.1 Cantidad de cocinas = 1 para quien tenía el servicio «Cocina» (antes de quitarlo de servicios).
update public.residences r
set amenity_details = r.amenity_details || '{"kitchens": 1}'::jsonb
where r.amenity_details -> 'kitchens' is null
  and exists (
    select 1 from public.residence_profile_sections s
    where s.residence_id = r.id and s.section_type = 'services' and s.content -> 'items' @> '["Cocina"]'::jsonb
  );

-- b.1 / c.2 Agrega «Gimnasio» y «Cocina compartida» a áreas comunes (crea la sección si falta; sin repetir).
insert into public.residence_profile_sections (residence_id, section_type, content)
select s.residence_id, 'common_areas', jsonb_build_object('items', '[]'::jsonb)
from public.residence_profile_sections s
where s.section_type = 'services'
  and (s.content -> 'items' @> '["Gimnasio"]'::jsonb or s.content -> 'items' @> '["Cocina"]'::jsonb)
on conflict (residence_id, section_type) do nothing;

update public.residence_profile_sections a
set content = jsonb_set(
  coalesce(a.content, '{}'::jsonb),
  '{items}',
  coalesce(a.content -> 'items', '[]'::jsonb)
    || case when s.content -> 'items' @> '["Gimnasio"]'::jsonb and not coalesce(a.content -> 'items', '[]'::jsonb) @> '["Gimnasio"]'::jsonb
            then '["Gimnasio"]'::jsonb else '[]'::jsonb end
    || case when s.content -> 'items' @> '["Cocina"]'::jsonb and not coalesce(a.content -> 'items', '[]'::jsonb) @> '["Cocina compartida"]'::jsonb
            then '["Cocina compartida"]'::jsonb else '[]'::jsonb end
)
from public.residence_profile_sections s
where a.section_type = 'common_areas'
  and s.section_type = 'services'
  and s.residence_id = a.residence_id
  and (s.content -> 'items' @> '["Gimnasio"]'::jsonb or s.content -> 'items' @> '["Cocina"]'::jsonb);

-- b.2 / c.3 Quita «Gimnasio» y «Cocina» de servicios.
update public.residence_profile_sections s
set content = jsonb_set(
  s.content,
  '{items}',
  coalesce(
    (select jsonb_agg(e) from jsonb_array_elements(s.content -> 'items') e where e not in ('"Gimnasio"'::jsonb, '"Cocina"'::jsonb)),
    '[]'::jsonb
  )
)
where s.section_type = 'services'
  and (s.content -> 'items' @> '["Gimnasio"]'::jsonb or s.content -> 'items' @> '["Cocina"]'::jsonb);

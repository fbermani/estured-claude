-- EstuRed — Migración 0052: edad mínima/máxima de residentes y habilitación de menores (DR14, fase 1)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Es ADITIVA e IDEMPOTENTE (add column if not exists, drop/add constraint) y no cambia el comportamiento actual:
--    las residencias existentes quedan con min 18, sin máximo y sin menores = sin filtrado por edad para nadie mayor de 18.
--    Hasta que se aplique, el código degrada con gracia: el catálogo no filtra por edad, la ficha no muestra rango
--    y el formulario de configuración avisa que todavía no se puede guardar la edad.
--
-- MOTIVO. docs/00 §31 DR14 (3) y docs/06 §8.1: cada residencia define edad mínima y máxima de sus residentes (filtro de búsqueda).
-- Piso 18; menores solo si la residencia lo habilita expresamente (`accepts_minors`). Decisión del dueño 2026-10-25: sin aprobación del admin.
--
-- QUÉ HACE
--   1. `residences.min_resident_age` smallint not null default 18, `max_resident_age` smallint null (null = sin tope),
--      `accepts_minors` boolean not null default false.
--   2. CHECKs: min entre 10 y 99 (rango razonable); min >= 18 salvo que accepts_minors; max entre 18 y 99; max >= min.
--   3. Las tres columnas son PÚBLICAS a propósito (se usan para filtrar y se muestran en la ficha). No cambia RLS ni policies:
--      la policy pública de `residences` ya expone solo filas verified_active; no hay que sumar nada a scripts/sensitive-columns.json.
--      La fecha de nacimiento del estudiante sigue siendo privada (el filtro se evalúa en el servidor).

alter table public.residences
  add column if not exists min_resident_age smallint not null default 18,
  add column if not exists max_resident_age smallint,
  add column if not exists accepts_minors boolean not null default false;

alter table public.residences drop constraint if exists residences_min_resident_age_range;
alter table public.residences add constraint residences_min_resident_age_range
  check (min_resident_age between 10 and 99);

alter table public.residences drop constraint if exists residences_min_age_floor;
alter table public.residences add constraint residences_min_age_floor
  check (min_resident_age >= 18 or accepts_minors);

alter table public.residences drop constraint if exists residences_max_resident_age_range;
alter table public.residences add constraint residences_max_resident_age_range
  check (max_resident_age is null or (max_resident_age between 18 and 99 and max_resident_age >= min_resident_age));

comment on column public.residences.min_resident_age is 'DR14: edad mínima de residentes (>= 18 salvo accepts_minors). Pública (filtro de búsqueda).';
comment on column public.residences.max_resident_age is 'DR14: edad máxima de residentes; null = sin tope. Pública.';
comment on column public.residences.accepts_minors is 'DR14: la residencia admite menores de 18 (con apartado para guardián). Decide la residencia sola. Pública.';

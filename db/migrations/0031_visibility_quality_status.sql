-- 0031 — Visibilidad y penalizaciones de calidad (Ciclo 34unodevicies-bis).
-- docs/09_ADMIN_PANEL_SPEC.md §23.
--
-- Diseño elegido (decisión delegada por el dueño): NO se duplica un
-- segundo campo de estado que se solape con `residences.status`. De los
-- 6 estados de docs §23.1, 3 ya tienen equivalente real en `status`
-- (`temporarily_paused`≈`paused_by_admin`, `suspended` ya existe,
-- `removed_from_network`≈`archived`) — esos se manejan con las
-- transiciones de `status` ya construidas, no acá. Este campo cubre
-- SOLO los 3 estados genuinamente nuevos: una señal de calidad que NO
-- saca a la residencia de publicación.
--
-- No incluye el motor de ranking automático (docs §23.2/23.3) — requiere
-- pipelines de métricas (tasa de respuesta, cancelaciones, etc.) que no
-- existen en el proyecto. Tampoco afecta el orden de /search — docs
-- dice explícitamente "no debe mostrarse ranking público en el MVP".

create type public.residence_quality_visibility_status as enum (
  'normal_visibility',
  'warning',
  'reduced_visibility'
);

alter table public.residences
  add column if not exists quality_visibility_status public.residence_quality_visibility_status not null default 'normal_visibility';

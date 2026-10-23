-- EstuRed — Migración 0043: datos privados de la residencia en `residence_private_details` (Ciclo 56)
-- FASE A de 2 (aditiva, NO rompe nada). La fase B es `0043b_drop_residence_sensitive_columns.sql`.
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado).
--
-- ORDEN DE DESPLIEGUE (importante):
--   1) Aplicar ESTA migración (0043) en la base.
--   2) Deployar el código del Ciclo 56 (lee/escribe los datos privados vía service role en la tabla nueva).
--   3) Aplicar `0043b_drop_residence_sensitive_columns.sql` (quita las columnas de `residences`). Recién ahí
--      deja de ser legible la dirección con la anon key.
--   Entre 1) y 2) el código viejo sigue funcionando (las columnas viejas siguen existiendo). Entre 2) y 3) el
--   código nuevo ya no usa las columnas viejas, pero siguen siendo legibles con la anon key: hacer 3) enseguida.
--
-- MOTIVO (hallazgo de seguridad del Ciclo 55). `residences` tiene la policy `residences_select_public`
-- (anon/authenticated ven TODA la fila de las residencias `verified_active`) y RLS de Postgres filtra por FILA,
-- no por columna. Con la anon key (pública) un `GET /rest/v1/residences?select=*` devolvía
-- el nombre y el teléfono del responsable, el motivo interno del acceso a Gestión Operativa y la señal de
-- calidad/visibilidad.
-- ALCANCE (aclaración del dueño, 2026-10-23): la dirección (`address_line`) y la ubicación de la residencia son
-- información PÚBLICA, así que NO se mueven ni se tratan como fuga. Solo se protege lo privado por naturaleza
-- (contacto del responsable, auditoría/flags internos, señal de moderación).
--
-- DISEÑO ELEGIDO: tabla privada 1:1 (en vez de VIEW pública + REVOKE de la tabla base).
--   - La VIEW obligaría a revocar SELECT de `residences` a anon/authenticated, y las policies existentes
--     (`residences_select_public/own`) y todos los embeds PostgREST `residences (name, public_area...)` desde
--     clientes con RLS (estudiante, familiar, residencia) pasarían a fallar con 42501 o a leer la view sin las
--     policies de `residences_select_own`. Mucho riesgo de romper el catálogo y los inbox.
--   - La tabla privada es el mismo patrón que `waitlist_signups`/`files`/`residence_faq_questions`: RLS
--     habilitado SIN policies + REVOKE explícito (doble barrera). Solo el service role (server) la lee y escribe.
--     `residences` no cambia de policies ni de forma para quien ya la usa.
--
-- QUÉ SE MUEVE (todo lo que no tiene por qué ser legible por anon/authenticated):
--   responsible_name, responsible_contact                         → PII (teléfono/nombre del responsable)
--   quality_visibility_status                                     → señal interna de moderación (docs/09 §23)
--   operational_access_granted_by / _at / _reason                 → auditoría interna del acceso a GO (el motivo
--                                                                    es texto libre del admin)
--   om_access_granted_by / _at                                    → columnas legadas de 0003 (sin uso en el código)
--   NO se mueven (siguen en `residences`; riesgo residual bajo, documentado en MEMORY.md §Ciclo 56):
--   has_operational_management_access, is_pioneer, pioneer_free_access_until, operating_mode, created_by.
--
-- CAMBIO:
--   1. Tabla `residence_private_details` (PK = residence_id, ON DELETE CASCADE) + trigger updated_at.
--   2. RLS habilitado SIN policies + REVOKE ALL a anon/authenticated.
--   3. Backfill desde `residences` (idempotente: ON CONFLICT DO NOTHING; no pisa nada ya cargado).
--   4. Trigger AFTER INSERT en `residences` que crea la fila privada vacía (garantiza el 1:1 aunque algún
--      script/test inserte `residences` directo). El código hace UPSERT sobre esa fila.
--   5. `residences.responsible_name/responsible_contact` pasan a NULLABLE (hoy son NOT NULL): el código nuevo
--      ya no las escribe ahí, y sin esto los INSERT de residencias nuevas fallarían entre 2) y 3).
--
-- NO RE-EJECUTABLE DESPUÉS DE 0043b: el backfill lee las columnas de `residences` que 0043b elimina (fallaría con
-- "column does not exist"). Si ya se aplicó 0043b, no volver a correr este archivo.
--
-- VERIFICACIÓN (correr al final; debe devolver `true` = una fila privada por cada residencia):
--   select (select count(*) from public.residences) = (select count(*) from public.residence_private_details) as ok;
--
-- REVERTIR (solo si todavía NO se aplicó 0043b):
--   drop trigger residences_create_private_details on public.residences;
--   drop function public.create_residence_private_details();
--   drop table public.residence_private_details;
--   -- (y volver a poner NOT NULL en responsible_* si todas las filas tienen valor)

create table if not exists public.residence_private_details (
  residence_id uuid primary key references public.residences (id) on delete cascade,
  responsible_name text,
  responsible_contact text,
  quality_visibility_status public.residence_quality_visibility_status not null default 'normal_visibility',
  operational_access_granted_by uuid references public.users (id),
  operational_access_granted_at timestamptz,
  operational_access_reason text,
  om_access_granted_by uuid references public.users (id),
  om_access_granted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists residence_private_details_updated_at on public.residence_private_details;
create trigger residence_private_details_updated_at before update on public.residence_private_details
  for each row execute function public.set_updated_at();

-- Sin policies a propósito (mismo criterio que `waitlist_signups`): nadie salvo el service role.
alter table public.residence_private_details enable row level security;
revoke all on public.residence_private_details from anon, authenticated;

comment on table public.residence_private_details is
  'Ciclo 56: datos PRIVADOS de la residencia (contacto del responsable, señal de calidad, auditoría de acceso a GO). RLS sin policies y REVOKE a anon/authenticated a propósito: solo service role. NO agregar policies "para que funcione".';

-- Backfill (idempotente: si la fila ya existe no se pisa).
insert into public.residence_private_details (
  residence_id, responsible_name, responsible_contact, quality_visibility_status,
  operational_access_granted_by, operational_access_granted_at, operational_access_reason,
  om_access_granted_by, om_access_granted_at, created_at
)
select
  r.id, r.responsible_name, r.responsible_contact, r.quality_visibility_status,
  r.operational_access_granted_by, r.operational_access_granted_at, r.operational_access_reason,
  r.om_access_granted_by, r.om_access_granted_at, r.created_at
from public.residences r
on conflict (residence_id) do nothing;

-- Garantiza el 1:1 para toda residencia futura. SECURITY DEFINER: corre aunque quien inserta no pueda
-- escribir en la tabla privada (el INSERT de la app va por service role, pero esto evita depender de eso).
create or replace function public.create_residence_private_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.residence_private_details (residence_id) values (new.id)
  on conflict (residence_id) do nothing;
  return new;
end;
$$;
revoke all on function public.create_residence_private_details() from public, anon, authenticated;

drop trigger if exists residences_create_private_details on public.residences;
create trigger residences_create_private_details after insert on public.residences
  for each row execute function public.create_residence_private_details();

-- El código nuevo no escribe `responsible_*` en `residences` (viven en la tabla privada).
alter table public.residences alter column responsible_name drop not null;
alter table public.residences alter column responsible_contact drop not null;

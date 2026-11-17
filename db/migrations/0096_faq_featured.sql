-- EstuRed — Migración 0096: preguntas frecuentes destacadas de la ficha (hasta 6, con orden)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. ADITIVA e IDEMPOTENTE; no toca filas existentes. Necesita: `residence_faq_items` (0054) y
--    `residence_faq_questions` (0039).
--    Hasta que se aplique, el código degrada con gracia: la ficha destaca las primeras 6 preguntas por orden (`lib/residences/featuredFaq.ts`)
--    y el panel de Preguntas avisa que elegir destacadas todavía no está disponible.
--
-- MOTIVO. Propuesta A de la ficha (SPEC, «Datos nuevos» 2): la residencia elige hasta 6 preguntas destacadas, con su orden. Se pueden destacar
-- las del catálogo que la residencia muestra (`residence_faq_items`) y las preguntas libres ya respondidas (`residence_faq_questions`).
-- Las 5 fijas del perfil (`residence_profile_sections.faq`, un jsonb) no se pueden destacar: no son filas.
--
-- QUÉ HACE
--   1. `is_featured boolean not null default false` y `featured_order smallint` (1 a 6) en ambas tablas, con CHECK de coherencia
--      (sin destacar no hay orden; destacada sí lo tiene).
--   2. Tope de 6 destacadas por residencia SUMANDO ambas tablas, con un trigger BEFORE INSERT/UPDATE (red de seguridad: la server action
--      ya valida). Un advisory lock por residencia evita la carrera entre dos guardados simultáneos.
--   3. Grants: `select (is_featured, featured_order)` donde la tabla ya es legible por la API (`residence_faq_items`: anon y authenticated).
--      `residence_faq_questions` no tiene policies ni grants para la API: se lee con el service role.
--
-- REVERTIR:
--   drop trigger if exists residence_faq_items_featured_max on public.residence_faq_items;
--   drop trigger if exists residence_faq_questions_featured_max on public.residence_faq_questions;
--   drop function if exists public.enforce_faq_featured_max();
--   alter table public.residence_faq_items drop constraint if exists residence_faq_items_featured_order_check, drop column if exists is_featured, drop column if exists featured_order;
--   alter table public.residence_faq_questions drop constraint if exists residence_faq_questions_featured_order_check, drop column if exists is_featured, drop column if exists featured_order;

begin;

do $$
begin
  if to_regclass('public.residence_faq_items') is null or to_regclass('public.residence_faq_questions') is null then
    raise exception '0096: faltan residence_faq_items (0054) / residence_faq_questions (0039)';
  end if;
end
$$;

-- ==== 1. Columnas ====
alter table public.residence_faq_items add column if not exists is_featured boolean not null default false;
alter table public.residence_faq_items add column if not exists featured_order smallint;
alter table public.residence_faq_questions add column if not exists is_featured boolean not null default false;
alter table public.residence_faq_questions add column if not exists featured_order smallint;

alter table public.residence_faq_items drop constraint if exists residence_faq_items_featured_order_check;
alter table public.residence_faq_items add constraint residence_faq_items_featured_order_check
  check ((is_featured and featured_order is not null and featured_order between 1 and 6) or (not is_featured and featured_order is null));

alter table public.residence_faq_questions drop constraint if exists residence_faq_questions_featured_order_check;
alter table public.residence_faq_questions add constraint residence_faq_questions_featured_order_check
  check ((is_featured and featured_order is not null and featured_order between 1 and 6) or (not is_featured and featured_order is null));

-- ==== 2. Tope de 6 por residencia (suma de ambas tablas) ====
create or replace function public.enforce_faq_featured_max()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  total integer;
begin
  if not new.is_featured then
    return new;
  end if;
  -- Serializa los guardados de la misma residencia (el lock se libera al cerrar la transacción).
  perform pg_advisory_xact_lock(hashtextextended('faq_featured:' || new.residence_id::text, 0));
  select
    (select count(*) from public.residence_faq_items i
      where i.residence_id = new.residence_id and i.is_featured and (tg_table_name <> 'residence_faq_items' or i.id <> new.id))
    +
    (select count(*) from public.residence_faq_questions q
      where q.residence_id = new.residence_id and q.is_featured and (tg_table_name <> 'residence_faq_questions' or q.id <> new.id))
  into total;
  if total >= 6 then
    raise exception 'Una residencia puede destacar hasta 6 preguntas frecuentes.' using errcode = 'check_violation';
  end if;
  return new;
end
$$;

drop trigger if exists residence_faq_items_featured_max on public.residence_faq_items;
create trigger residence_faq_items_featured_max before insert or update of is_featured on public.residence_faq_items
  for each row execute function public.enforce_faq_featured_max();

drop trigger if exists residence_faq_questions_featured_max on public.residence_faq_questions;
create trigger residence_faq_questions_featured_max before insert or update of is_featured on public.residence_faq_questions
  for each row execute function public.enforce_faq_featured_max();

-- Índice para contar rápido las destacadas por residencia.
create index if not exists residence_faq_items_featured_idx on public.residence_faq_items (residence_id) where is_featured;
create index if not exists residence_faq_questions_featured_idx on public.residence_faq_questions (residence_id) where is_featured;

-- ==== 3. Grants por columna (la tabla del catálogo ya es legible por la API; las columnas nuevas no son sensibles) ====
grant select (is_featured, featured_order) on public.residence_faq_items to anon, authenticated;

commit;

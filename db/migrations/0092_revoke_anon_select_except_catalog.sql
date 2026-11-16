-- 0092 — Quitar SELECT de `anon` sobre las tablas de `public` que no son catálogo público (auditoría de seguridad 2026-11-16, bajo).
--
-- Supabase otorga SELECT a anon sobre toda tabla nueva. Hoy RLS lo neutraliza (no hay policies para anon fuera de las 10 de catálogo
-- público: residences, room_types, profile_availability, profile_availability_genders, residence_profile_sections,
-- residence_regulation_versions, residence_faq_items, residence_faq_predefined_questions, residence_custom_amenities, exchange_rates),
-- pero dependía de que nadie cree una policy abierta por error. Complementa a 0090 (que sacó las escrituras).
--
-- Las 10 tablas de catálogo conservan sus grants (a nivel tabla o por columna, 0081): no se tocan. `authenticated` y `service_role` no cambian.
-- Tablas nuevas de catálogo público que anon deba leer necesitan `grant select ... to anon` explícito. Idempotente. No toca datos.

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'v', 'm', 'p')
      and c.relname not in (
        'residences', 'room_types', 'profile_availability', 'profile_availability_genders',
        'residence_profile_sections', 'residence_regulation_versions', 'residence_faq_items',
        'residence_faq_predefined_questions', 'residence_custom_amenities', 'exchange_rates'
      )
      and has_table_privilege('anon', c.oid, 'SELECT')
  loop
    execute format('revoke select on table public.%I from anon', t.relname);
  end loop;
end $$;

-- Tablas futuras: que no nazcan legibles para anon (lo que cree el rol que corre las migraciones).
alter default privileges in schema public revoke select on tables from anon;

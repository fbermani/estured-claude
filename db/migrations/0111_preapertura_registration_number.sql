-- EstuRed — Migración 0111: número de registro de la preapertura (DR67 d)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO en producción (por separado de estured-dev). IDEMPOTENTE; necesita 0080.
--    El código DEGRADA si todavía no está aplicada: «Mi lugar» carga sin el número.
--
-- QUÉ HACE
--   1. `preapertura_estudiantes.registration_number`: número fijo por fila, solo para estudiantes. No se recalcula.
--   2. Secuencia `preapertura_registro_seq` desde 11: nadie recibe del 1 al 10.
--   3. Numera a los estudiantes ya registrados, por orden de alta.
--   4. Un trigger BEFORE INSERT asigna el número (ignora lo que mande quien inserta). Los familiares quedan sin número.
--
-- SEGURIDAD: la tabla sigue con RLS sin policies (solo service role). La secuencia y la función no son ejecutables por anon/authenticated.
--
-- SUPUESTOS REVERSIBLES
--   - Solo los estudiantes reciben número (DR67 d).
--   - Puede haber huecos: si un alta falla después de pedir el número, ese número no se reutiliza.
--
-- REVERTIR (la secuencia cae sola con la columna):
--   drop trigger if exists preapertura_estudiantes_registration_number on public.preapertura_estudiantes;
--   drop function if exists public.preapertura_set_registration_number();
--   drop index if exists public.preapertura_estudiantes_registration_number_key;
--   alter table public.preapertura_estudiantes drop column if exists registration_number;

begin;
alter table public.preapertura_estudiantes add column if not exists registration_number integer;
create sequence if not exists public.preapertura_registro_seq as integer start with 11 minvalue 11;
alter sequence public.preapertura_registro_seq owned by public.preapertura_estudiantes.registration_number;
revoke all on sequence public.preapertura_registro_seq from public, anon, authenticated;
grant usage, select on sequence public.preapertura_registro_seq to service_role;

do $$
declare r record;
begin
  for r in select id from public.preapertura_estudiantes
           where role = 'student' and registration_number is null order by created_at, id loop
    update public.preapertura_estudiantes
      set registration_number = nextval('public.preapertura_registro_seq') where id = r.id;
  end loop;
end $$;

create unique index if not exists preapertura_estudiantes_registration_number_key
  on public.preapertura_estudiantes (registration_number);

create or replace function public.preapertura_set_registration_number()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role = 'student' then
    new.registration_number := nextval('public.preapertura_registro_seq');
  else
    new.registration_number := null;
  end if;
  return new;
end $$;
revoke all on function public.preapertura_set_registration_number() from public, anon, authenticated;

drop trigger if exists preapertura_estudiantes_registration_number on public.preapertura_estudiantes;
create trigger preapertura_estudiantes_registration_number before insert on public.preapertura_estudiantes
  for each row execute function public.preapertura_set_registration_number();
commit;

-- 0057 — Género por habitación (DR18 fase 2, punto 15 del Owner)
--
-- Hoy el género vive solo en room_types.gender_policy (por tipo). Pasa a poder
-- definirse POR HABITACIÓN: un mismo tipo puede tener habitaciones con distinto
-- género ("2 dobles: 1 masculina, 1 femenina"). room_types.gender_policy se
-- conserva como valor por defecto del tipo (compatibilidad); no se borra.
--
-- Valores: masculino | femenino | mixto | sin_especificar.
--   * sin_especificar solo vale para tipos individuales (capacidad 1).
--   * Una habitación compartida (capacidad > 1) no puede quedar sin especificar.
--
-- RLS: rooms ya tiene RLS habilitado SIN policies (solo service role, 0024);
-- la columna nueva hereda ese fail-closed. No se agregan policies ni grants.

alter table public.rooms
  add column if not exists gender text not null default 'sin_especificar'
  check (gender in ('masculino', 'femenino', 'mixto', 'sin_especificar'));

-- Función de derivación: género por defecto de una habitación según su tipo.
create or replace function public.room_default_gender(p_room_type_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when rt.gender_policy = 'solo_hombres' then 'masculino'
    when rt.gender_policy = 'solo_mujeres' then 'femenino'
    when rt.gender_policy = 'mixto' then 'mixto'
    when coalesce(rt.capacity_per_room, 1) > 1 then 'mixto'
    else 'sin_especificar'
  end
  from public.room_types rt
  where rt.id = p_room_type_id;
$$;
revoke all on function public.room_default_gender(uuid) from public, anon, authenticated;

-- Backfill: cada habitación hereda el género de su tipo (sin pisar nada ya definido).
update public.rooms r
   set gender = coalesce(public.room_default_gender(r.room_type_id), 'sin_especificar')
 where r.gender = 'sin_especificar';

-- Regla "compartida no puede quedar sin especificar":
--   * al INSERTAR (p. ej. el sync de habitaciones, que no conoce el género) se
--     completa con el valor por defecto del tipo, sin fallar;
--   * al ACTUALIZAR a sin_especificar en un tipo compartido se rechaza.
create or replace function public.rooms_enforce_gender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
begin
  select coalesce(capacity_per_room, 1) into v_capacity
    from public.room_types where id = new.room_type_id;

  if tg_op = 'INSERT' and new.gender = 'sin_especificar' then
    new.gender := coalesce(public.room_default_gender(new.room_type_id), 'sin_especificar');
  end if;

  if new.gender = 'sin_especificar' and coalesce(v_capacity, 1) > 1 then
    if tg_op = 'INSERT' then
      new.gender := 'mixto';
    else
      raise exception 'Una habitación compartida debe ser masculina, femenina o mixta.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rooms_enforce_gender on public.rooms;
create trigger rooms_enforce_gender
  before insert or update of gender, room_type_id on public.rooms
  for each row execute function public.rooms_enforce_gender();

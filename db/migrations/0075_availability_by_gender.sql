-- EstuRed — Migración 0075: disponibilidad detallada por tipo de habitación Y género
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. Es ADITIVA e IDEMPOTENTE (create ... if not exists, drop policy if exists, on conflict do nothing).
--    Necesita: `residences`, `room_types`, `rooms` con `gender` (0057), `users`, `set_updated_at()` y `is_residence_team_member()` (0058).
--    Hasta que se aplique, el código degrada con gracia: la pantalla Disponibilidad informa por tipo de habitación, como antes (una sola fila
--    por tipo, sin género), y la ficha y el catálogo no muestran el detalle por género.
--
-- DECISIÓN DEL DUEÑO (2026-11-03). La disponibilidad se informa POR TIPO + GÉNERO («Dobles masculinas», «Dobles femeninas», «Dobles mixtas»),
-- calculada desde las habitaciones y camas ya cargadas; la residencia solo confirma o ajusta. Se gestiona únicamente desde la pantalla
-- Disponibilidad (Habitaciones deja de tener controles de disponibilidad).
--
-- QUÉ HACE
--   1. Tabla nueva `profile_availability_genders`: una fila por (tipo de habitación, género) con estado (disponible / completa / pausada por la
--      residencia), cantidad disponible, «disponible desde», nota pública y quién/cuándo la confirmó. Único por (room_type_id, gender).
--      Género: masculino | femenino | mixto | sin_especificar (los mismos valores que `rooms.gender`, 0057).
--   2. `profile_availability` (UNA fila por tipo, `unique(room_type_id)`) NO cambia. Pasa a ser el RESUMEN del tipo: el servidor lo recalcula cada
--      vez que la residencia guarda el detalle por género. Así siguen funcionando, sin tocarlos, todos los que lo leen: solicitudes y propuestas
--      (gate por tipo), reserva confirmada (descuenta 1), salida de un residente (repone 1), lista de espera, mes vacío, jobs de vencimiento
--      (`checkStaleAvailability`: 30 días → «sin actualizar», 45 → oculta) y las pantallas del admin. Se eligió tabla nueva y no una columna
--      `gender` + `unique(room_type_id, gender)` justamente porque ~12 lecturas dependen de que sea 1 fila por tipo (embed singular y `maybeSingle`).
--   3. Backfill: por cada fila existente de `profile_availability`, se crea el detalle copiando estado, «desde» y nota, con un género por cada género
--      distinto de las habitaciones activas del tipo (si no hay habitaciones, el género por defecto del tipo). La cantidad se copia solo cuando hay
--      UN género; con varios queda en null (no se puede repartir sin inventar): la residencia la completa desde Disponibilidad. El estado
--      `not_updated` / `paused_by_admin` del tipo se copia como «disponible» en el detalle; el resumen del tipo sigue mandando (el más restrictivo gana).
--   4. RLS fail-closed: el equipo activo lee las suyas (función SECURITY DEFINER de la 0058, sin recursión) y el público lee solo las de residencias
--      `verified_active`. SIN policies de escritura (y se revocan insert/update/delete a anon/authenticated): escribe solo el service role, desde la
--      server action con permiso `operations.rooms_availability`. Solo columnas públicas (sin `last_confirmed_by`).
--   Sin cambios en `profile_availability`, `scripts/sensitive-columns.json` ni en el cron.
--
-- REVERTIR: drop table if exists public.profile_availability_genders;   -- el resumen por tipo sigue intacto

begin;

do $$
begin
  if to_regclass('public.residences') is null or to_regclass('public.room_types') is null or to_regclass('public.rooms') is null then
    raise exception '0075: faltan residences / room_types / rooms';
  end if;
  if to_regclass('public.profile_availability') is null then
    raise exception '0075: falta profile_availability (migración 0003)';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0075: falta la función set_updated_at';
  end if;
  if to_regprocedure('public.is_residence_team_member(uuid)') is null then
    raise exception '0075: falta is_residence_team_member (migración 0058)';
  end if;
  if to_regprocedure('public.room_default_gender(uuid)') is null then
    raise exception '0075: falta room_default_gender (migración 0057)';
  end if;
end
$$;

create table if not exists public.profile_availability_genders (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  gender text not null check (gender in ('masculino', 'femenino', 'mixto', 'sin_especificar')),
  -- La residencia solo carga estos tres; `not_updated` lo calcula el job y `paused_by_admin` es solo de EstuRed (ambos viven en el resumen del tipo).
  status public.profile_availability_status not null default 'available_to_confirm'
    check (status in ('available_to_confirm', 'full', 'paused_by_residence')),
  available_count integer check (available_count is null or available_count >= 0),
  available_from date,
  notes_public text check (notes_public is null or char_length(notes_public) <= 300),
  last_confirmed_by uuid references public.users (id) on delete set null,
  last_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_type_id, gender)
);

create index if not exists profile_availability_genders_residence_idx on public.profile_availability_genders (residence_id);

drop trigger if exists profile_availability_genders_updated_at on public.profile_availability_genders;
create trigger profile_availability_genders_updated_at before update on public.profile_availability_genders
  for each row execute function public.set_updated_at();

alter table public.profile_availability_genders enable row level security;

drop policy if exists availability_genders_select_team on public.profile_availability_genders;
create policy availability_genders_select_team on public.profile_availability_genders
  for select to authenticated using (public.is_residence_team_member(residence_id));

drop policy if exists availability_genders_select_public on public.profile_availability_genders;
create policy availability_genders_select_public on public.profile_availability_genders
  for select to anon, authenticated using (
    residence_id in (select id from public.residences where status = 'verified_active')
  );

-- Solo lectura desde la API y solo columnas públicas: `last_confirmed_by` no se expone. El código lee y escribe con el service role.
revoke all on public.profile_availability_genders from anon, authenticated;
grant select (id, residence_id, room_type_id, gender, status, available_count, available_from, notes_public, last_confirmed_at, created_at, updated_at)
  on public.profile_availability_genders to anon, authenticated;

-- Backfill (idempotente: `on conflict do nothing`). Un género por cada género distinto de las habitaciones activas del tipo.
insert into public.profile_availability_genders
  (residence_id, room_type_id, gender, status, available_count, available_from, notes_public, last_confirmed_by, last_confirmed_at)
select
  e.residence_id,
  e.room_type_id,
  g.gender,
  case when e.status in ('full', 'paused_by_residence') then e.status else 'available_to_confirm' end::public.profile_availability_status,
  case when cardinality(e.genders) = 1 then e.available_count end,
  e.available_from,
  e.notes_public,
  e.last_confirmed_by,
  e.last_confirmed_at
from (
  select
    pa.residence_id,
    pa.room_type_id,
    pa.status,
    pa.available_count,
    pa.available_from,
    pa.notes_public,
    pa.last_confirmed_by,
    pa.last_confirmed_at,
    coalesce(
      (
        select array_agg(distinct x.g)
        from (
          select case
                   when r.gender <> 'sin_especificar' then r.gender
                   else coalesce(public.room_default_gender(r.room_type_id), 'sin_especificar')
                 end as g
          from public.rooms r
          where r.room_type_id = pa.room_type_id and r.is_active = true
        ) x
      ),
      array[coalesce(public.room_default_gender(pa.room_type_id), 'sin_especificar')]
    ) as genders
  from public.profile_availability pa
) e
cross join lateral unnest(e.genders) as g(gender)
on conflict (room_type_id, gender) do nothing;

comment on table public.profile_availability_genders is 'Disponibilidad por tipo de habitación y género (0075). El resumen del tipo vive en profile_availability (se recalcula al guardar). Escribe solo el service role.';

-- VERIFICACIÓN
--   select count(*) from public.profile_availability_genders;                    -- al menos una fila por cada tipo con disponibilidad
--   select room_type_id, count(*) from public.profile_availability_genders group by 1 having count(*) > 1;   -- tipos con varios géneros (cantidad en null)
--   -- como anon: debe dar "permission denied" →  select last_confirmed_by from public.profile_availability_genders;

commit;

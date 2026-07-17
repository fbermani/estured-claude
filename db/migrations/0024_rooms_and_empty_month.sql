-- 0024 — Habitaciones físicas + cargo de "mes vacío" (Ciclo 34unvicies).
--
-- Decisión del dueño (2026-07-15): el desglose de comunidad debe ser por
-- habitación (quién vive en cada una y qué camas quedan libres), como en
-- la referencia `estured_comunidad_actual_modal_full_view`, y la previa
-- de reserva debe reflejar los cargos de la referencia — incluido el
-- "mes vacío", que la residencia setea en su configuración.
--
-- Alcance deliberado: esto NO es Gestión Operativa (docs/00 §6.2 — plan
-- pago con disponibilidad en tiempo real por plaza). `rooms` acá es solo
-- estructura física para mostrar la comunidad; la disponibilidad oficial
-- sigue siendo `profile_availability` a nivel tipo (informativa).
--
-- Supuesto reversible documentado (mes vacío): meses calendario COMPLETOS
-- entre la solicitud y la fecha de ingreso, cobrados a
-- `empty_month_charge_percent` % de la renta mensual (la referencia usa
-- 75%: USD 210 sobre renta USD 280). NULL = la residencia no cobra mes
-- vacío y la línea no aparece. Solo se usa en la previa informativa de la
-- solicitud — el cobro real sigue el flujo de negociación/snapshot.

-- ==== rooms ====
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  label text not null,             -- "Habitación 1", "Suite B-104", etc.
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();
create index rooms_residence_idx on public.rooms (residence_id, sort_order);
create index rooms_room_type_idx on public.rooms (room_type_id);

-- Mismo patrón que waitlist_signups: RLS habilitado sin policies — solo
-- el service role lee/escribe (la comunidad pública se arma server-side).
alter table public.rooms enable row level security;

-- ==== resident_stays.room_id ====
alter table public.resident_stays
  add column room_id uuid references public.rooms (id);
create index resident_stays_room_idx on public.resident_stays (room_id);

-- ==== room_types.empty_month_charge_percent ====
alter table public.room_types
  add column empty_month_charge_percent numeric(5, 2)
    check (empty_month_charge_percent is null
      or (empty_month_charge_percent >= 0 and empty_month_charge_percent <= 100));

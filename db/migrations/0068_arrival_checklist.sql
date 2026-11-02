-- EstuRed — Migración 0068: checklist de llegada compartido (DR29, Fase 2 del Centro de Guías, lote 2A)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE (tabla con `if not exists`, drop/create de policies y funciones); no modifica filas existentes.
--    Necesita: `reservations` (0010), `student_profiles`, `users` e `is_family_member_of_student` (0006/0046).
--    Hasta que se aplique, el código degrada con gracia: la tarjeta «Tu llegada» muestra el checklist en solo lectura, sin tildes
--    persistentes.
--
-- MOTIVO. docs/00 DR29: el estudiante con reserva futura tilda un checklist de llegada (catálogo estático en
-- `lib/arrival/checklist.ts`); el familiar vinculado ACTIVO lo ve en SOLO LECTURA (progreso).
--
-- QUÉ HACE
--   1. Tabla `arrival_checklist_items`: una fila por ítem tildado (reserva + `item_key`). Destildar = borrar la fila.
--   2. RLS: SELECT para el estudiante dueño de la reserva y para el familiar vinculado activo; INSERT y DELETE solo para el
--      estudiante dueño. Sin UPDATE. Las funciones que cruzan tablas son SECURITY DEFINER (evita recursión de RLS).
--   3. La validación de que `item_key` pertenezca al catálogo se hace en el server action (el catálogo vive en código); la tabla
--      solo acota longitud/formato.
--
-- REVERTIR (borra los tildes; el código vuelve a degradar con gracia):
--   drop table if exists public.arrival_checklist_items;
--   drop function if exists public.is_reservation_student(uuid);
--   drop function if exists public.can_read_arrival_checklist(uuid);

begin;

do $$
begin
  if to_regclass('public.reservations') is null then
    raise exception '0068: falta la tabla reservations (migración 0010)';
  end if;
  if to_regprocedure('public.is_family_member_of_student(uuid)') is null then
    raise exception '0068: falta la función is_family_member_of_student (migraciones 0006/0046)';
  end if;
end
$$;

create table if not exists public.arrival_checklist_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 80 and item_key ~ '^[a-z0-9_.-]+$'),
  checked_by uuid references public.users (id) on delete set null,
  checked_at timestamptz not null default now(),
  unique (reservation_id, item_key)
);
create index if not exists arrival_checklist_items_reservation_idx on public.arrival_checklist_items (reservation_id);

-- ¿El usuario autenticado es el estudiante dueño de la reserva y esta está en un estado válido (confirmed, receipt_pending, receipt_issued)?
create or replace function public.is_reservation_student(p_reservation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reservations r
    join public.student_profiles sp on sp.id = r.student_profile_id
    where r.id = p_reservation_id and sp.user_id = (select auth.uid())
      and r.status in ('confirmed', 'receipt_pending', 'receipt_issued')
  );
$$;

-- ¿El usuario autenticado puede leer el checklist? Estudiante dueño o familiar vinculado ACTIVO.
create or replace function public.can_read_arrival_checklist(p_reservation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reservations r
    join public.student_profiles sp on sp.id = r.student_profile_id
    where r.id = p_reservation_id
      and (sp.user_id = (select auth.uid()) or public.is_family_member_of_student(sp.id))
  );
$$;

revoke all on function public.is_reservation_student(uuid) from public, anon;
revoke all on function public.can_read_arrival_checklist(uuid) from public, anon;
grant execute on function public.is_reservation_student(uuid) to authenticated;
grant execute on function public.can_read_arrival_checklist(uuid) to authenticated;

alter table public.arrival_checklist_items enable row level security;

drop policy if exists arrival_checklist_items_select on public.arrival_checklist_items;
create policy arrival_checklist_items_select on public.arrival_checklist_items
  for select to authenticated using (public.can_read_arrival_checklist(reservation_id));

drop policy if exists arrival_checklist_items_insert on public.arrival_checklist_items;
create policy arrival_checklist_items_insert on public.arrival_checklist_items
  for insert to authenticated with check (public.is_reservation_student(reservation_id) and checked_by = (select auth.uid()));

drop policy if exists arrival_checklist_items_delete on public.arrival_checklist_items;
create policy arrival_checklist_items_delete on public.arrival_checklist_items
  for delete to authenticated using (public.is_reservation_student(reservation_id));

revoke all on public.arrival_checklist_items from anon;
revoke all on public.arrival_checklist_items from authenticated;
grant select, insert, delete on public.arrival_checklist_items to authenticated;

commit;

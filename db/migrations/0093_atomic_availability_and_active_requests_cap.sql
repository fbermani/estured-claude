-- 0093 — Atomicidad en dos puntos con carrera (revisión de código 2026-11-17).
--
-- (a) DESCUENTO DE PLAZAS. confirmReservationAfterFeePaid leía `profile_availability.available_count` y escribía `count - 1` en dos
--     consultas: dos confirmaciones simultáneas del mismo tipo leían el mismo valor y descontaban una sola vez. Ahora el descuento es un
--     único UPDATE (la expresión se evalúa sobre la fila bloqueada) expuesto como RPC solo para service_role.
-- (b) TOPE DE 2 SOLICITUDES ACTIVAS (docs/00 §9). createApplicationRequest contaba y después insertaba: dos envíos simultáneos pasaban
--     el conteo. Un trigger BEFORE INSERT con advisory lock por estudiante los serializa (mismo patrón que 0036 para el tope de 10 residencias).
--     La lista de estados activos replica ACTIVE_APPLICATION_STATUSES (lib/applications/types.ts): si cambia allá, cambia acá.
--
-- ROLLBACK: drop trigger application_requests_enforce_active_cap on public.application_requests;
--           drop function public.enforce_application_active_cap(); drop function public.decrement_profile_availability(uuid);
-- Idempotente. No toca datos.

create or replace function public.decrement_profile_availability(p_room_type_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profile_availability
  set
    available_count = greatest(0, coalesce(available_count, 1) - 1),
    status = case
      when greatest(0, coalesce(available_count, 1) - 1) = 0 then 'full'::public.profile_availability_status
      else status
    end
  where room_type_id = p_room_type_id;
$$;

revoke all on function public.decrement_profile_availability(uuid) from public, anon, authenticated;
grant execute on function public.decrement_profile_availability(uuid) to service_role;

create or replace function public.enforce_application_active_cap()
returns trigger
language plpgsql
as $$
begin
  if new.status::text in (
    'submitted', 'queued_for_place', 'under_review', 'contact_established', 'offer_pending_student_acceptance',
    'conditions_accepted', 'paused_due_to_other_active_request', 'residence_payment_pending', 'residence_payment_reported'
  ) then
    perform pg_advisory_xact_lock(hashtext('app_active_cap:' || new.student_profile_id::text));
    if (
      select count(*) from public.application_requests
      where student_profile_id = new.student_profile_id
        and status::text in (
          'submitted', 'queued_for_place', 'under_review', 'contact_established', 'offer_pending_student_acceptance',
          'conditions_accepted', 'paused_due_to_other_active_request', 'residence_payment_pending', 'residence_payment_reported'
        )
    ) >= 2 then
      raise exception 'Un estudiante no puede tener más de 2 solicitudes activas';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists application_requests_enforce_active_cap on public.application_requests;
create trigger application_requests_enforce_active_cap
  before insert on public.application_requests
  for each row execute function public.enforce_application_active_cap();

-- ==== Verificación (descomentar y correr después de aplicar) ====
-- select proname from pg_proc where proname in ('decrement_profile_availability', 'enforce_application_active_cap'); -- 2 filas
-- select tgname from pg_trigger where tgname = 'application_requests_enforce_active_cap'; -- 1 fila

-- 0091 — Topes de largo en los textos libres de solicitudes, negociación y propuestas del familiar
-- (auditoría de seguridad 2026-11-16, hallazgo medio: cualquier usuario autenticado podía guardar textos de ~1 MB que luego ve la residencia).
-- Los topes de las server actions son 1000 (500 en política de ajuste y motivo del estudiante); el CHECK deja margen 2x
-- como red de seguridad de base. Idempotente. Dev: datos existentes ≤ 87 caracteres.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'application_requests_academic_objective_len') then
    alter table public.application_requests
      add constraint application_requests_academic_objective_len check (char_length(academic_objective) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'application_requests_rejection_reason_internal_len') then
    alter table public.application_requests
      add constraint application_requests_rejection_reason_internal_len check (char_length(rejection_reason_internal) <= 2000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'negotiation_proposals_special_conditions_len') then
    alter table public.application_negotiation_proposals
      add constraint negotiation_proposals_special_conditions_len check (char_length(special_conditions) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'negotiation_proposals_internal_notes_len') then
    alter table public.application_negotiation_proposals
      add constraint negotiation_proposals_internal_notes_len check (char_length(internal_notes) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'negotiation_proposals_adjustment_policy_len') then
    alter table public.application_negotiation_proposals
      add constraint negotiation_proposals_adjustment_policy_len check (char_length(proposed_adjustment_policy) <= 1000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'application_status_events_reason_text_len') then
    alter table public.application_status_events
      add constraint application_status_events_reason_text_len check (char_length(reason_text) <= 2000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'family_proposals_message_len') then
    alter table public.family_application_proposals
      add constraint family_proposals_message_len check (char_length(message_to_student) <= 2000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'family_proposals_rejection_reason_len') then
    alter table public.family_application_proposals
      add constraint family_proposals_rejection_reason_len check (char_length(rejection_reason) <= 1000);
  end if;
end $$;

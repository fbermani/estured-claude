-- EstuRed — Migración 0008: negociación de condiciones (fase 2 del loop)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §11.3, docs/03 §10ter, docs/07 §15.4-15.6,
-- docs/08 §6.6 y §7.9.
--
-- Nombre de estado: docs/03 §10ter.7 usa 'accepted_conditions_pending_payment'
-- en su descripción narrativa, pero el enum técnico (docs/06 §4.5, ya
-- creado en la migración 0007) define 'conditions_accepted'. Se usa el
-- nombre del enum — es la fuente técnica canónica y ya está en producción.

create table public.application_negotiation_proposals (
  id uuid primary key default gen_random_uuid(),
  application_request_id uuid not null references public.application_requests (id) on delete cascade,
  sent_by_user_id uuid not null references public.users (id),
  residence_id uuid not null references public.residences (id),
  proposed_monthly_price_usd numeric(14,2),
  proposed_monthly_price_ars numeric(14,2),
  proposed_enrollment_fee_usd numeric(14,2),
  proposed_enrollment_fee_ars numeric(14,2),
  proposed_deposit_usd numeric(14,2),
  proposed_deposit_ars numeric(14,2),
  proposed_room_type_id uuid references public.room_types (id),
  proposed_place_id uuid,
  proposed_start_date date,
  proposed_duration_months integer,
  proposed_adjustment_policy text,
  proposed_reservation_payment_amount_usd numeric(14,2),
  special_conditions text,
  internal_notes text,
  warning_shown_at timestamptz,
  warning_accepted_at timestamptz,
  student_response text check (student_response in ('accepted', 'rejected_chose_original', 'rejected_closed')),
  student_response_at timestamptz,
  student_response_by_user_id uuid references public.users (id),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_request_id) -- docs/03 §10ter.3: máximo 1 por solicitud
);
create trigger negotiation_proposals_updated_at before update on public.application_negotiation_proposals
  for each row execute function public.set_updated_at();
create index negotiation_proposals_request_idx on public.application_negotiation_proposals (application_request_id);

alter table public.application_negotiation_proposals enable row level security;
create policy negotiation_proposals_select_related on public.application_negotiation_proposals
  for select to authenticated using (
    application_request_id in (
      select id from public.application_requests
      where student_profile_id in (
        select id from public.student_profiles where user_id = (select auth.uid())
      )
      or public.is_family_member_of_student(student_profile_id)
      or residence_id in (
        select residence_id from public.residence_users
        where user_id = (select auth.uid()) and is_active = true
      )
    )
  );

comment on table public.application_negotiation_proposals is
  'Propuesta de ajuste de condiciones (docs/03 §10ter). Máx. 1 por solicitud, solo la residencia la crea.';

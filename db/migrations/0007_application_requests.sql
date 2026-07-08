-- EstuRed — Migración 0007: solicitudes de reserva (fase 1)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §11.1-11.2 y §11.4, docs/00 §9 y §9.1,
-- docs/07_API_SPEC.md §15.1-15.3 y §15.7.
--
-- Alcance de esta migración (fase 1 del loop, decisión del dueño
-- 2026-07-08): solo solicitud → revisión → contacto establecido /
-- rechazo. NO incluye negociación (application_negotiation_proposals),
-- pago a residencia, fee ni reserva — quedan para fases siguientes.
-- El enum application_status se crea completo (docs/06 §4.5) porque
-- es más simple que extenderlo después; solo se usa un subconjunto acá.

create type public.application_status as enum (
  'draft', 'submitted', 'queued_for_place', 'under_review', 'contact_established',
  'offer_pending_student_acceptance', 'conditions_accepted',
  'paused_due_to_other_active_request', 'residence_payment_pending',
  'residence_payment_reported', 'converted_to_reservation', 'rejected',
  'expired_no_residence_response', 'expired_no_student_payment',
  'expired_offer_no_response', 'cancelled_by_student', 'cancelled_by_residence',
  'closed_due_to_other_confirmed_reservation', 'disputed'
);

-- ==== application_snapshots (docs/06 §11.2) ====
-- Se crea ANTES que application_requests la referencia, pero
-- application_requests.snapshot_original_id la necesita — se resuelve
-- con FKs diferibles: creamos snapshots primero sin FK a la solicitud
-- (la relación inversa alcanza), y application_requests apunta a ella.
create table public.application_snapshots (
  id uuid primary key default gen_random_uuid(),
  application_request_id uuid, -- se completa después del insert (ver server action)
  snapshot_type text not null check (snapshot_type in ('original', 'final')),
  residence_id uuid not null references public.residences (id),
  room_type_id uuid not null references public.room_types (id),
  place_id uuid,
  monthly_price_usd numeric(14,2) not null,
  monthly_price_ars numeric(14,2) not null,
  exchange_rate_ars_per_usd numeric(14,6) not null,
  exchange_rate_source text not null,
  exchange_rate_date date not null,
  initial_duration_months integer not null,
  enrollment_fee_usd numeric(14,2),
  enrollment_fee_ars numeric(14,2),
  deposit_usd numeric(14,2),
  deposit_ars numeric(14,2),
  deposit_excluded_from_fee boolean not null default true,
  reservation_payment_amount_usd numeric(14,2),
  reservation_payment_amount_ars numeric(14,2),
  adjustment_policy text not null,
  fee_base_usd numeric(14,2),
  fee_base_ars numeric(14,2),
  estimated_estured_fee_ars numeric(14,2),
  main_rules_snapshot jsonb not null default '{}'::jsonb,
  reservation_conditions_snapshot jsonb not null default '{}'::jsonb,
  services_snapshot jsonb not null default '{}'::jsonb,
  raw_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ==== application_requests (docs/06 §11.1) ====
create table public.application_requests (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id),
  family_link_id uuid references public.family_links (id),
  initiated_by text not null default 'student' check (initiated_by in ('student', 'family_member')),
  contact_target text not null check (contact_target in ('student', 'family_member')),
  residence_id uuid not null references public.residences (id),
  room_type_id uuid not null references public.room_types (id),
  place_id uuid,
  status public.application_status not null default 'submitted',
  desired_start_date date not null,
  initial_duration_months integer not null,
  academic_objective text not null,
  snapshot_original_id uuid not null references public.application_snapshots (id),
  snapshot_final_id uuid references public.application_snapshots (id),
  proposal_count integer not null default 0,
  active_request_group_id uuid,
  contact_established_at timestamptz,
  payment_deadline_at timestamptz,
  rejection_reason_code text,
  rejection_reason_internal text,
  cancelled_reason text,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger application_requests_updated_at before update on public.application_requests
  for each row execute function public.set_updated_at();
create index application_requests_student_idx on public.application_requests (student_profile_id);
create index application_requests_residence_idx on public.application_requests (residence_id);
create index application_requests_status_idx on public.application_requests (status);

alter table public.application_snapshots
  add constraint application_snapshots_request_fk
  foreign key (application_request_id) references public.application_requests (id) on delete cascade;

-- ==== application_status_events (docs/06 §11.4) — historial, append-only ====
create table public.application_status_events (
  id uuid primary key default gen_random_uuid(),
  application_request_id uuid not null references public.application_requests (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  changed_by_user_id uuid references public.users (id),
  changed_by_role text not null,
  reason_code text,
  reason_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index application_status_events_request_idx on public.application_status_events (application_request_id);

-- ==== Row Level Security ====
-- Patrón consistente con el resto del proyecto: escrituras solo vía
-- service role (server actions); lectura filtrada por RLS.

alter table public.application_requests enable row level security;
create policy application_requests_select_student on public.application_requests
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );
create policy application_requests_select_family on public.application_requests
  for select to authenticated using (public.is_family_member_of_student(student_profile_id));
create policy application_requests_select_residence on public.application_requests
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

alter table public.application_snapshots enable row level security;
create policy application_snapshots_select_related on public.application_snapshots
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

-- application_status_events: sin policies — solo service role (mismo
-- patrón que audit_logs; es historial interno, no se expone directo).
alter table public.application_status_events enable row level security;

comment on table public.application_requests is 'Solicitudes de reserva (docs/06 §11.1). Fase 1: hasta contact_established/rejected. Sin pago/fee/negociación aún.';

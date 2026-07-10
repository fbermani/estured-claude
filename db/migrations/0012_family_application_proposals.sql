-- EstuRed — Migración 0012: propuesta de solicitud del familiar
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §7, docs/03 §3.2 y §10bis, docs/07 §9,
-- docs/04 §21.1/§22-23, docs/08 §6.3 y §9.2.
--
-- Alcance: crear propuesta (familiar) → aprobar/rechazar (estudiante) →
-- si aprueba, se crea application_requests (initiated_by=family_member,
-- contact_target=family_member). Vencimiento a 48h resuelto con el mismo
-- patrón "lazy" ya usado en application_negotiation_proposals (chequeo
-- de expires_at en el momento de la acción, no un cron — el job
-- 'expire_family_proposals' de docs/07 §9.4 queda pendiente, mismo gap
-- ya documentado para application_requests.expires_at en MEMORY.md §14).
--
-- Nota (análisis crítico, no ambigüedad bloqueante): docs/06 §7.1 no
-- incluye 'academic_objective' entre los campos de la propuesta, pero
-- application_requests.academic_objective es not null. Se resuelve
-- pidiéndoselo al ESTUDIANTE en el momento de aprobar (no al familiar):
-- es un dato sobre los objetivos del propio estudiante, tiene más
-- sentido de producto que lo escriba quien va a vivir la experiencia,
-- y encaja con el patrón ya usado ("Modal antes de aprobar" exige
-- confirmación explícita de todos modos). Supuesto reversible, documentado.

create type public.family_proposal_status as enum (
  'pending_student_approval', 'approved_by_student', 'rejected_by_student', 'expired'
);

create table public.family_application_proposals (
  id uuid primary key default gen_random_uuid(),
  family_link_id uuid not null references public.family_links (id),
  family_member_id uuid not null references public.family_members (id),
  student_profile_id uuid not null references public.student_profiles (id),
  residence_id uuid not null references public.residences (id),
  room_type_id uuid not null references public.room_types (id),
  desired_start_date date not null,
  initial_duration_months integer not null,
  status public.family_proposal_status not null default 'pending_student_approval',
  message_to_student text,
  rejection_reason text,
  student_response_at timestamptz,
  student_response_by_user_id uuid references public.users (id),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  converted_to_application_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger family_application_proposals_updated_at before update on public.family_application_proposals
  for each row execute function public.set_updated_at();
create index family_application_proposals_student_idx on public.family_application_proposals (student_profile_id, status);
create index family_application_proposals_family_idx on public.family_application_proposals (family_member_id, status);
create index family_application_proposals_expires_idx on public.family_application_proposals (expires_at);

-- ==== application_requests.family_proposal_id (docs/06 §11.1, fila nueva) ====
alter table public.application_requests
  add column family_proposal_id uuid references public.family_application_proposals (id);

alter table public.family_application_proposals
  add constraint family_application_proposals_converted_fk
  foreign key (converted_to_application_id) references public.application_requests (id);

-- ==== Row Level Security ====
-- Mismo patrón que el resto del proyecto: escrituras solo vía service
-- role (server actions); lectura filtrada por RLS.

alter table public.family_application_proposals enable row level security;
create policy family_proposals_select_family on public.family_application_proposals
  for select to authenticated using (
    family_member_id in (
      select id from public.family_members where user_id = (select auth.uid())
    )
  );
create policy family_proposals_select_student on public.family_application_proposals
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );

comment on table public.family_application_proposals is
  'Propuesta de solicitud del familiar (docs/06 §7, docs/03 §10bis). No visible para la residencia hasta que el estudiante la aprueba. Terminales: approved_by_student, rejected_by_student, expired.';

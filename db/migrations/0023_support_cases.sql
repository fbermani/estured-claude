-- EstuRed — Migración 0023: soporte y resolución de conflictos
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/12_BUILD_PLAN.md Fase 14, docs/03_BUSINESS_RULES.md §22,
-- docs/00_DECISION_LOG.md §23, docs/05_ROLES_AND_PERMISSIONS.md §17.1.
-- Nombre "soporte y resolución de conflictos" (no "mediación") a propósito
-- — implicancias legales de la Ley 26.589 argentina, ya documentado en
-- los docs fuente.
--
-- Alcance de este ciclo (34quindecies): abrir caso con recordatorio de
-- términos + evidencia real + panel admin con cambio de estado. Los
-- resultados que ya existen como acciones separadas (reembolso del fee →
-- revokeEsturedFee, suspensión de residencia → setResidencePausedByAdmin,
-- bloqueo de usuario → setUserBlockedStatus) quedan MANUALES: el admin
-- lee el caso y dispara esas herramientas ya construidas, no hay
-- automatización desde acá — decisión explícita del dueño, evita
-- acoplar de más con flujos de dinero ya probados.

create type public.support_case_status as enum (
  'opened', 'submitted', 'under_review', 'needs_more_info',
  'waiting_other_party', 'in_progress', 'resolved_by_agreement',
  'closed_no_action', 'closed_unresolved', 'admin_action_taken'
);

-- `terms_reminder_shown` (docs/12) se resuelve como un timestamp en vez de
-- un estado propio del enum — mismo criterio que otros "gates" de
-- confirmación del proyecto (ver `warning_shown_at`/`warning_accepted_at`
-- en negociaciones, migración 0008): es una precondición para poder crear
-- la fila, no un estado que el caso transite después.
create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  opened_by_user_id uuid not null references public.users (id),
  opened_by_role text not null,
  residence_id uuid not null references public.residences (id),
  related_entity_type text,
  related_entity_id uuid,
  description text not null check (char_length(description) >= 20),
  status public.support_case_status not null default 'opened',
  resolution_outcome text
    check (resolution_outcome in (
      'closed_no_action', 'warning', 'agreement_between_parties',
      'estured_fee_refund', 'alternative_recommended',
      'visibility_penalty', 'suspension', 'expulsion'
    )),
  resolution_notes text,
  terms_reminder_accepted_at timestamptz not null,
  assigned_admin_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger support_cases_updated_at before update on public.support_cases
  for each row execute function public.set_updated_at();
create index support_cases_residence_idx on public.support_cases (residence_id, status);
create index support_cases_opened_by_idx on public.support_cases (opened_by_user_id);

-- ==== Row Level Security ====
alter table public.support_cases enable row level security;
create policy support_cases_select_opener on public.support_cases
  for select to authenticated using (opened_by_user_id = (select auth.uid()));
create policy support_cases_select_residence on public.support_cases
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

-- ==== Evidencia: reusa la tabla `files` ya existente (docs/06 §26,
-- bucket `support-evidence` — agregado a scripts/setup-storage.mjs) ====
alter type public.document_type add value if not exists 'support_case_evidence';

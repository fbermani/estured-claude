-- 0027 — Revisión de ediciones de perfil (Ciclo 34sexvicies).
-- docs/09_ADMIN_PANEL_SPEC.md §8, docs/06_DATA_MODEL.md §8.5,
-- docs/00_DECISION_LOG.md (Fase 11): cambios críticos al perfil de una
-- residencia YA verificada/publicada (fotos, servicios, reglas +
-- documentación, mínimo de estadía, tipos de habitación) quedan
-- pendientes de aprobación admin en vez de aplicarse al instante — antes
-- de esta migración la tabla no existía y ningún código la usaba, pese
-- a que `residence_profile_sections.requires_admin_review` ya guardaba
-- ese flag sin que nada lo leyera.
--
-- El gate solo aplica a residencias `verified_active` (protege una
-- publicación ya revisada); durante el alta/onboarding (draft,
-- pending_verification, needs_changes) los cambios se siguen aplicando
-- directo, porque esa etapa ya pasa por revisión completa en
-- `/admin/verifications`.

create type public.residence_profile_edit_status as enum (
  'draft_update', 'pending_admin_review', 'approved', 'rejected', 'cancelled_by_residence'
);

create table public.residence_profile_edits (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  -- 'photos' | 'services' | 'rules' | 'minimum_stay_months' | 'room_types'
  field_group text not null,
  old_value jsonb,
  new_value jsonb not null,
  status public.residence_profile_edit_status not null default 'pending_admin_review',
  submitted_by uuid not null references public.users (id),
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger residence_profile_edits_updated_at before update on public.residence_profile_edits
  for each row execute function public.set_updated_at();
create index residence_profile_edits_residence_idx on public.residence_profile_edits (residence_id, field_group, status);
create index residence_profile_edits_queue_idx on public.residence_profile_edits (status, created_at);

-- Mismo patrón que rooms/beds/resident_notes: RLS habilitado sin
-- policies — solo el service role lee/escribe.
alter table public.residence_profile_edits enable row level security;

-- EstuRed — Migración 0004: familiar vinculado
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §6.3-6.4, docs/00_DECISION_LOG.md §17,
-- docs/08_UI_SCREENS_AND_FLOWS.md §5.5.

create type public.family_link_status as enum (
  'pending_student_approval', 'active', 'rejected_by_student',
  'revoked_by_student', 'revoked_by_family', 'suspended_minor_no_family'
);

-- ==== family_members (docs/06 §6.3) ====
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  relationship_type text not null check (relationship_type in ('padre', 'madre', 'tutor', 'familiar')),
  identity_document_number text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger family_members_updated_at before update on public.family_members
  for each row execute function public.set_updated_at();

-- ==== family_links (docs/06 §6.4) ====
create table public.family_links (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  family_member_id uuid not null references public.family_members (id) on delete cascade,
  status public.family_link_status not null default 'pending_student_approval',
  requested_by_user_id uuid not null references public.users (id),
  approved_at timestamptz,
  revoked_at timestamptz,
  permissions jsonb not null default '{
    "can_view_dashboard": true,
    "can_add_favorites": true,
    "can_upload_documents": true,
    "can_upload_payment_proofs": true,
    "can_pay_estured_fee": true,
    "can_download_receipts": true,
    "can_create_proposals": true
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger family_links_updated_at before update on public.family_links
  for each row execute function public.set_updated_at();
create index family_links_student_idx on public.family_links (student_profile_id);
create index family_links_family_idx on public.family_links (family_member_id);

-- Regla docs/06 §6.4 y docs/00 §17: solo 1 familiar activo por estudiante.
-- Un familiar sí puede tener varios estudiantes vinculados (sin constraint
-- simétrico del lado family_member_id).
create unique index family_links_one_active_per_student
  on public.family_links (student_profile_id)
  where status = 'active';

-- ==== Row Level Security ====

alter table public.family_members enable row level security;
create policy family_members_select_own on public.family_members
  for select to authenticated using (user_id = (select auth.uid()));

alter table public.family_links enable row level security;
-- Visible tanto para el estudiante como para el familiar de ese vínculo.
create policy family_links_select_related on public.family_links
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
    or family_member_id in (
      select id from public.family_members where user_id = (select auth.uid())
    )
  );

comment on table public.family_links is 'Vínculo estudiante-familiar. Solo 1 activo por estudiante (docs/00 §17). Escrituras vía service role.';

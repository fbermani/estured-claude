-- EstuRed — Migración 0003: residencias, onboarding y perfil público
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §4.2-4.3, §4.18-4.19, §8 (residences,
-- residence_users, residence_verifications, residence_profile_sections),
-- §9.1 (room_types), §9.4 (profile_availability), §16.1 (files),
-- y docs/12_BUILD_PLAN.md Fase 2.
--
-- Extensiones no bloqueantes respecto al modelo documental (decisiones
-- de implementación, no de producto — ver comentarios inline):
--   - residences.tagline, residences.property_type
--   - room_types.gender_policy, bathroom_type, features, minimum_stay_months
--   - document_type: + 'residence_photo', 'residence_rules_document'
--   - residence_profile_sections.section_type: + 'near_universities'

-- ==== Enums (docs/06 §4) ====
create type public.residence_status as enum (
  'draft', 'pending_verification', 'verification_scheduled', 'verified_active',
  'needs_changes', 'paused_by_residence', 'paused_by_admin', 'suspended',
  'verification_expired', 'archived'
);

create type public.residence_operating_mode as enum (
  'verified_profile', 'operational_management'
);

create type public.profile_availability_status as enum (
  'available_to_confirm', 'full', 'not_updated', 'paused_by_residence', 'paused_by_admin'
);

create type public.document_status as enum (
  'uploaded', 'pending_review', 'approved', 'rejected', 'expired', 'archived'
);

create type public.document_type as enum (
  'student_identity', 'student_academic_proof', 'student_family_authorization',
  'student_payment_proof_to_residence', 'family_identity',
  'residence_responsible_identity', 'residence_coordinator_identity',
  'residence_signed_checklist', 'residence_terms_acceptance',
  'residence_payment_receipt', 'estured_fee_fiscal_receipt',
  'residence_photo', 'residence_rules_document', -- extensión: ver cabecera
  'other'
);

-- ==== residences (docs/06 §8.1) ====
create table public.residences (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique,
  tagline text check (char_length(tagline) <= 80),          -- extensión: eslogan
  property_type text check (property_type in (               -- extensión
    'residencia_estudiantil', 'departamento', 'casa_compartida'
  )),
  description text,
  status public.residence_status not null default 'draft',
  operating_mode public.residence_operating_mode not null default 'verified_profile',
  address_line text,
  public_area text,           -- zona/barrio visible
  city text not null default 'CABA',
  province text not null default 'Buenos Aires',
  country text not null default 'Argentina',
  responsible_name text not null,
  responsible_contact text not null,   -- privado, solo admin/owner
  total_capacity integer,
  is_pioneer boolean not null default false,
  pioneer_free_access_until date,
  has_operational_management_access boolean not null default false,
  om_access_granted_by uuid references public.users (id),
  om_access_granted_at timestamptz,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger residences_updated_at before update on public.residences
  for each row execute function public.set_updated_at();
create index residences_status_idx on public.residences (status);
create index residences_slug_idx on public.residences (slug);

-- ==== residence_users (docs/06 §8.2) ====
create table public.residence_users (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references public.users (id),
  invitation_status text not null default 'accepted'
    check (invitation_status in ('pending', 'accepted', 'revoked')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (residence_id, user_id)
);
create trigger residence_users_updated_at before update on public.residence_users
  for each row execute function public.set_updated_at();
create index residence_users_user_idx on public.residence_users (user_id);
create index residence_users_residence_idx on public.residence_users (residence_id);

-- Regla docs/06 §8.2: hasta 10 residencias por owner. Se valida también
-- server-side; el trigger es la barrera dura.
create or replace function public.enforce_owner_residence_limit()
returns trigger language plpgsql as $$
begin
  if new.role = 'owner' and new.is_active then
    if (
      select count(*) from public.residence_users
      where user_id = new.user_id and role = 'owner' and is_active = true
    ) >= 10 then
      raise exception 'Un owner no puede tener más de 10 residencias activas';
    end if;
  end if;
  return new;
end $$;
create trigger residence_users_owner_limit
  before insert on public.residence_users
  for each row execute function public.enforce_owner_residence_limit();

-- ==== residence_verifications (docs/06 §8.3) ====
create table public.residence_verifications (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  status text not null default 'not_started' check (status in (
    'not_started', 'documents_pending', 'visit_pending', 'visit_scheduled',
    'under_review', 'approved', 'rejected', 'needs_changes', 'expired', 'revoked'
  )),
  scheduled_at timestamptz,
  visited_at timestamptz,
  verified_by_user_id uuid references public.users (id),
  responsible_identity_checked boolean not null default false,
  coordinator_identity_checked boolean not null default false,
  address_checked boolean not null default false,
  photos_match_reality boolean not null default false,
  signed_checklist_file_id uuid,
  notes_internal text,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger residence_verifications_updated_at before update on public.residence_verifications
  for each row execute function public.set_updated_at();
create index residence_verifications_residence_idx on public.residence_verifications (residence_id);

-- ==== residence_profile_sections (docs/06 §8.4) ====
-- section_type: 'services' | 'rules' | 'common_areas' | 'near_universities' (extensión) | 'faq'
create table public.residence_profile_sections (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  section_type text not null,
  content jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  requires_admin_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (residence_id, section_type)
);
create trigger residence_profile_sections_updated_at before update on public.residence_profile_sections
  for each row execute function public.set_updated_at();
create index residence_profile_sections_residence_idx on public.residence_profile_sections (residence_id);

-- ==== room_types (docs/06 §9.1) ====
create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  name text not null,             -- Individual, Doble, Triple, Cuádruple, Compartida
  description text,
  gender_policy text check (gender_policy in ('mixto', 'solo_hombres', 'solo_mujeres')), -- extensión
  bathroom_type text check (bathroom_type in ('privado', 'compartido')),                  -- extensión
  features jsonb not null default '[]'::jsonb,     -- extensión: ["ventana","balcon"]
  capacity_per_room integer not null default 1,
  monthly_price_usd numeric(14,2) not null check (monthly_price_usd > 0),
  monthly_price_ars numeric(14,2) not null check (monthly_price_ars > 0),
  enrollment_fee_usd numeric(14,2),
  enrollment_fee_ars numeric(14,2),
  deposit_usd numeric(14,2),
  deposit_ars numeric(14,2),
  deposit_is_refundable boolean not null default true,
  adjustment_policy text not null default 'quarterly'
    check (adjustment_policy in ('monthly', 'quarterly', 'semiannual', 'annual', 'none')),
  minimum_stay_months integer,                     -- extensión
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger room_types_updated_at before update on public.room_types
  for each row execute function public.set_updated_at();
create index room_types_residence_idx on public.room_types (residence_id);

-- ==== profile_availability (docs/06 §9.4) — Modo Perfil Verificado ====
create table public.profile_availability (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  room_type_id uuid not null references public.room_types (id) on delete cascade,
  status public.profile_availability_status not null default 'available_to_confirm',
  available_count integer,
  available_from date,
  last_confirmed_by uuid references public.users (id),
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz,
  hidden_from_search_at timestamptz,
  notes_public text,
  notes_internal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_type_id)
);
create trigger profile_availability_updated_at before update on public.profile_availability
  for each row execute function public.set_updated_at();
create index profile_availability_residence_idx on public.profile_availability (residence_id);

-- ==== files (docs/06 §16.1) — metadata; el binario vive en Storage ====
create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users (id),
  related_entity_type text not null,
  related_entity_id uuid not null,
  bucket text not null,
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  visibility text not null default 'private' check (visibility in ('private', 'context_shared', 'public')),
  document_type public.document_type not null,
  status public.document_status not null default 'uploaded',
  uploaded_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger files_updated_at before update on public.files
  for each row execute function public.set_updated_at();
create index files_related_idx on public.files (related_entity_type, related_entity_id);

-- ==== Row Level Security ====

alter table public.residences enable row level security;
-- Público: solo residencias verificadas y activas.
create policy residences_select_public on public.residences
  for select to anon, authenticated using (status = 'verified_active');
-- Owner/staff: su propia residencia en cualquier estado.
create policy residences_select_own on public.residences
  for select to authenticated using (
    id in (select residence_id from public.residence_users
           where user_id = (select auth.uid()) and is_active = true)
  );

alter table public.residence_users enable row level security;
create policy residence_users_select_own on public.residence_users
  for select to authenticated using (user_id = (select auth.uid()));

-- residence_verifications: sin policies de escritura para el usuario
-- (la crea/actualiza el service role); lectura solo para owner/staff.
alter table public.residence_verifications enable row level security;
create policy residence_verifications_select_own on public.residence_verifications
  for select to authenticated using (
    residence_id in (select residence_id from public.residence_users
                      where user_id = (select auth.uid()) and is_active = true)
  );

alter table public.residence_profile_sections enable row level security;
create policy profile_sections_select_public on public.residence_profile_sections
  for select to anon, authenticated using (
    is_public = true and residence_id in (
      select id from public.residences where status = 'verified_active'
    )
  );
create policy profile_sections_select_own on public.residence_profile_sections
  for select to authenticated using (
    residence_id in (select residence_id from public.residence_users
                      where user_id = (select auth.uid()) and is_active = true)
  );

alter table public.room_types enable row level security;
create policy room_types_select_public on public.room_types
  for select to anon, authenticated using (
    is_active = true and residence_id in (
      select id from public.residences where status = 'verified_active'
    )
  );
create policy room_types_select_own on public.room_types
  for select to authenticated using (
    residence_id in (select residence_id from public.residence_users
                      where user_id = (select auth.uid()) and is_active = true)
  );

alter table public.profile_availability enable row level security;
create policy availability_select_public on public.profile_availability
  for select to anon, authenticated using (
    residence_id in (select id from public.residences where status = 'verified_active')
  );
create policy availability_select_own on public.profile_availability
  for select to authenticated using (
    residence_id in (select residence_id from public.residence_users
                      where user_id = (select auth.uid()) and is_active = true)
  );

-- files: sin policies — solo service role (mismo patrón que audit_logs).
-- Las fotos públicas se sirven directo desde el bucket de Storage, no
-- se lee esta tabla desde el cliente.
alter table public.files enable row level security;

comment on table public.residences is 'Residencias estudiantiles. Solo status=verified_active es público (docs/06 §8.1).';
comment on table public.files is 'Metadata de archivos. RLS sin policies: solo service role. Binario en Supabase Storage.';

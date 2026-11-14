-- 0087 — Registro de aperturas de documentos de estudiantes por residencias (DR48, 2026-11-14).
--
-- DR48 (docs/00 §31) reemplaza DR38 punto 5: el dueño de una residencia (y el staff con el casillero que corresponda) puede abrir
-- los documentos que el estudiante subió a su perfil (bucket privado `student-documents`) cuando ese estudiante es residente
-- actual de ESA residencia o le pidió lugar y la solicitud ya tiene el pago a la residencia habilitado. Sin pedir motivo, pero
-- cada apertura queda registrada acá (quién, qué archivo, qué residencia, por qué vínculo y cuándo) además del audit log
-- `residence_document_accessed`. El link firmado dura 300 s.
--
-- Mismo patrón que `document_access_log` (0029): RLS habilitado SIN policies, solo el service role lee y escribe.
-- El registro sobrevive al borrado del archivo (`on delete set null`) para no perder la traza: por eso guarda también el tipo
-- de documento y el perfil del estudiante.

create table if not exists public.residence_document_access_log (
  id uuid primary key default gen_random_uuid(),
  file_id uuid references public.files (id) on delete set null,
  document_type text not null,
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  user_id uuid not null references public.users (id),
  actor_role text not null check (actor_role in ('residence_owner', 'residence_staff')),
  access_basis text not null check (access_basis in ('resident', 'applicant')),
  application_request_id uuid references public.application_requests (id) on delete set null,
  accessed_at timestamptz not null default now()
);

create index if not exists residence_document_access_log_residence_idx
  on public.residence_document_access_log (residence_id, accessed_at desc);
create index if not exists residence_document_access_log_student_idx
  on public.residence_document_access_log (student_profile_id, accessed_at desc);
create index if not exists residence_document_access_log_user_idx
  on public.residence_document_access_log (user_id, accessed_at desc);
create index if not exists residence_document_access_log_file_idx
  on public.residence_document_access_log (file_id);

alter table public.residence_document_access_log enable row level security;
-- Sin policies a propósito: ni `anon` ni `authenticated` leen ni escriben (solo el service role desde el servidor).
revoke all on public.residence_document_access_log from anon, authenticated;

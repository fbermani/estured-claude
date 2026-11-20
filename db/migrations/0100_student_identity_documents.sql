-- EstuRed — Migración 0100: documento de identidad del estudiante (DR58, docs/00 §31)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. Es ADITIVA e IDEMPOTENTE (se puede correr dos veces).
--    Necesita 0002 (`student_profiles`) y `set_updated_at()`.
--    Hasta que se aplique, el código degrada con gracia: el formulario de documento avisa que no está disponible.
--
-- QUÉ HACE
--   Crea `student_identity_documents`: una fila por estudiante con tipo (dni | passport | other) y número normalizado.
--   Va en tabla aparte, no en `student_profiles`, porque esa tabla se lee con `select *` desde la sesión del usuario
--   y tiene una policy de lectura para el familiar vinculado: un grant por columna sería frágil.
--   RLS activado y SIN policies: solo el service role lee y escribe (mismo patrón que `residence_private_details`).
--   Se revoca todo a anon/authenticated por si algún default grant lo abriera.
--   El formato del número se valida en el servidor (lib/students/identityDocument.ts); acá solo hay un check de largo.
--
-- ROLLBACK: `drop table public.student_identity_documents;` (solo borra el número; el archivo subido no se toca).

create table if not exists public.student_identity_documents (
  student_profile_id uuid primary key references public.student_profiles (id) on delete cascade,
  document_type text not null check (document_type in ('dni', 'passport', 'other')),
  document_number text not null check (char_length(document_number) between 5 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists student_identity_documents_updated_at on public.student_identity_documents;
create trigger student_identity_documents_updated_at before update on public.student_identity_documents
  for each row execute function public.set_updated_at();

alter table public.student_identity_documents enable row level security;
revoke all on public.student_identity_documents from anon, authenticated;

comment on table public.student_identity_documents is 'DR58: documento de identidad del estudiante. Privado: RLS sin policies, solo service role. Nunca en logs ni en auditoría.';

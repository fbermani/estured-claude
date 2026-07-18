-- 0029 — Justificación obligatoria de acceso a documentos (Ciclo 34novovicies).
-- docs/09_ADMIN_PANEL_SPEC.md §18.2: "El acceso admin debe requerir
-- justificación obligatoria registrada antes de visualizar, generando
-- un audit log específico (no solo 'se accedió', sino el motivo
-- declarado)."
--
-- Antes de esta migración, 4 pantallas admin (payments, verifications,
-- support-cases, profile-edits) generaban un signed URL de Storage
-- server-side sin ningún gate ni registro de motivo — confirmado por
-- grep antes de este ciclo.

create table public.document_access_log (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files (id) on delete cascade,
  admin_user_id uuid not null references public.users (id),
  reason_text text not null check (char_length(reason_text) >= 10),
  accessed_at timestamptz not null default now()
);
create index document_access_log_file_idx on public.document_access_log (file_id, accessed_at desc);
create index document_access_log_admin_idx on public.document_access_log (admin_user_id, accessed_at desc);

-- Mismo patrón que el resto del proyecto: RLS habilitado sin policies,
-- solo el service role lee/escribe.
alter table public.document_access_log enable row level security;

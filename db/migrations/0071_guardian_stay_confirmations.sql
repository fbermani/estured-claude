-- EstuRed — Migración 0071: confirmación del tutor para la estadía de un menor (DR32)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE (`if not exists`); no modifica filas existentes ni estados de `resident_stays`.
--    Necesita: `student_profiles`, `residences`, `resident_stays` (0019), `users` y la función `is_family_member_of_student` (0004).
--    Hasta que se aplique, el flujo de menores sigue como antes (bloqueo sin tutor, vínculo directo con tutor) sin romper nada.
--
-- MOTIVO. docs/00 DR32: la estadía de un menor queda pendiente hasta que su familiar/tutor activo la confirme.
--
-- QUÉ HACE
--   1. Tabla `guardian_stay_confirmations` (pending/confirmed/rejected/expired/cancelled) con UNIQUE parcial: una pendiente por estudiante.
--   2. RLS: lee el propio estudiante y su familiar con vínculo ACTIVO; NO hay policies de escritura (solo el service role escribe).
--
-- REVERTIR:
--   drop table if exists public.guardian_stay_confirmations;

begin;

do $$
begin
  if to_regclass('public.resident_stays') is null then
    raise exception '0071: falta la tabla resident_stays (migración 0019)';
  end if;
end
$$;

create table if not exists public.guardian_stay_confirmations (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  origin text not null check (origin in ('invite', 'residence_approval')),
  resident_stay_id uuid references public.resident_stays (id) on delete set null,
  invitation_id uuid,
  link_request_id uuid,
  residence_actor_user_id uuid references public.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'expired', 'cancelled')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reminded_at timestamptz,
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users (id) on delete set null
);

create unique index if not exists guardian_stay_confirmations_one_pending
  on public.guardian_stay_confirmations (student_profile_id) where status = 'pending';
create index if not exists guardian_stay_confirmations_pending_idx
  on public.guardian_stay_confirmations (expires_at) where status = 'pending';

alter table public.guardian_stay_confirmations enable row level security;

drop policy if exists guardian_stay_confirmations_select_student on public.guardian_stay_confirmations;
create policy guardian_stay_confirmations_select_student on public.guardian_stay_confirmations
  for select to authenticated using (
    student_profile_id in (select id from public.student_profiles where user_id = (select auth.uid()))
  );

drop policy if exists guardian_stay_confirmations_select_family on public.guardian_stay_confirmations;
create policy guardian_stay_confirmations_select_family on public.guardian_stay_confirmations
  for select to authenticated using (public.is_family_member_of_student(student_profile_id));
-- Sin policies de insert/update/delete a propósito: solo el service role escribe.

commit;

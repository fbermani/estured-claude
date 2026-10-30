-- EstuRed — Migración 0064: vinculación estudiante ↔ estadía con prueba de identidad (DR19)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    IDEMPOTENTE; necesita 0019 (resident_stays), 0043 (residence_private_details) y 0002 (student_profiles).
--    Hasta que se aplique, el código degrada con gracia: activar una estadía y enviar solicitudes de vínculo avisan que "todavía no está disponible".
--
-- QUÉ HACE
--   1. `resident_stay_invitations`: invitaciones personales a un residente ya cargado en `resident_stays`. Guarda SOLO el SHA-256 del token
--      (`token_hash`, único), el canal (`email` | `whatsapp` | `manual`), el vencimiento (14 días), el uso/revocación/rechazo ("no soy yo")
--      y el código OTP al mail (`otp_email` = mail al que se mandó, `otp_hash`, vencimiento, intentos, verificación). Una sola invitación ABIERTA por estadía (índice único parcial).
--      RLS habilitada SIN policies y sin grants para `anon`/`authenticated`: solo el service role (server actions).
--   2. `resident_link_requests`: solicitud de vínculo del estudiante alojado que se registra solo. Estados pending/approved/rejected.
--      Único `pending` por (estudiante, residencia). El estudiante lee las suyas por RLS; escribir y que la residencia las resuelva
--      va por service role con el permiso `residents.manage` validado en el servidor (los permisos del staff no se pueden expresar en RLS).
--   3. `residence_private_details.house_code`: código de casa (6 caracteres sin ambiguos, único). Esa tabla ya es solo service role.
--   4. `missing_residence_requests`: «Mi residencia no está» (nombre + contacto opcional). Solo service role.
--
-- SEGURIDAD: ni el token, ni su hash, ni el OTP, ni el código de casa son legibles con anon ni con un JWT. Policies nuevas: solo
-- `resident_link_requests_select_own`, que consulta `student_profiles` igual que `resident_stays_select_student` (sin recursión).
--
-- REVERTIR (también: drop function public.consume_invite_otp_attempt(uuid, integer, integer); drop function public.register_invite_otp_send(uuid, integer); borra invitaciones, solicitudes y pedidos; las estadías ya activadas NO se tocan):
--   drop table if exists public.resident_stay_invitations;
--   drop table if exists public.resident_link_requests;
--   drop table if exists public.missing_residence_requests;
--   drop index if exists public.residence_private_details_house_code_unique;
--   alter table public.residence_private_details drop column if exists house_code;

begin;

do $$
begin
  if to_regclass('public.resident_stays') is null or to_regclass('public.residence_private_details') is null
     or to_regclass('public.student_profiles') is null then
    raise exception '0064: faltan resident_stays / residence_private_details / student_profiles (migraciones 0019, 0043)';
  end if;
end
$$;

-- ==== 1. Invitaciones personales ====
create table if not exists public.resident_stay_invitations (
  id uuid primary key default gen_random_uuid(),
  resident_stay_id uuid not null references public.resident_stays (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  token_hash text unique check (token_hash is null or char_length(token_hash) = 64),
  channel text not null check (channel in ('email', 'whatsapp', 'manual')),
  created_by uuid references public.users (id) on delete set null,
  expires_at timestamptz not null,
  sent_at timestamptz,
  send_count integer not null default 0,
  used_at timestamptz,
  used_by_user_id uuid references public.users (id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text,
  declined_at timestamptz,
  otp_hash text,
  otp_expires_at timestamptz,
  otp_sent_at timestamptz,
  otp_attempts integer not null default 0,        -- acumulado por invitación (nunca se resetea)
  otp_code_attempts integer not null default 0,   -- del código vigente (se resetea al pedir uno nuevo)
  otp_send_count integer not null default 0,      -- códigos enviados por esta invitación (tope persistido)
  otp_verified_at timestamptz,
  otp_email text,
  created_at timestamptz not null default now(),
  constraint resident_stay_invitations_token_required check (channel = 'manual' or token_hash is not null)
);

create unique index if not exists resident_stay_invitations_one_open
  on public.resident_stay_invitations (resident_stay_id)
  where used_at is null and revoked_at is null;
create index if not exists resident_stay_invitations_stay_idx on public.resident_stay_invitations (resident_stay_id, created_at desc);
create index if not exists resident_stay_invitations_residence_idx on public.resident_stay_invitations (residence_id);

alter table public.resident_stay_invitations enable row level security;
revoke all on public.resident_stay_invitations from anon, authenticated;

-- ==== 2. Solicitudes de vínculo ====
create table if not exists public.resident_link_requests (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  matched_stay_id uuid references public.resident_stays (id) on delete set null,
  message text check (message is null or char_length(message) <= 280),
  via_house_code boolean not null default false,
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists resident_link_requests_one_pending
  on public.resident_link_requests (student_profile_id, residence_id) where status = 'pending';
create index if not exists resident_link_requests_residence_idx on public.resident_link_requests (residence_id, status, created_at desc);
create index if not exists resident_link_requests_student_idx on public.resident_link_requests (student_profile_id, status);

drop trigger if exists resident_link_requests_updated_at on public.resident_link_requests;
create trigger resident_link_requests_updated_at before update on public.resident_link_requests
  for each row execute function public.set_updated_at();

alter table public.resident_link_requests enable row level security;
revoke all on public.resident_link_requests from anon, authenticated;
grant select on public.resident_link_requests to authenticated;
drop policy if exists resident_link_requests_select_own on public.resident_link_requests;
create policy resident_link_requests_select_own on public.resident_link_requests
  for select to authenticated using (
    student_profile_id in (select id from public.student_profiles where user_id = (select auth.uid()))
  );

-- ==== 3. Código de casa ====
alter table public.residence_private_details add column if not exists house_code text;
alter table public.residence_private_details drop constraint if exists residence_private_details_house_code_fmt;
alter table public.residence_private_details add constraint residence_private_details_house_code_fmt
  check (house_code is null or house_code ~ '^[A-HJ-NP-Z2-9]{6}$');
create unique index if not exists residence_private_details_house_code_unique
  on public.residence_private_details (house_code) where house_code is not null;

-- ==== 4. «Mi residencia no está» ====
create table if not exists public.missing_residence_requests (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid references public.student_profiles (id) on delete set null,
  residence_name text not null check (char_length(btrim(residence_name)) between 2 and 120),
  contact text check (contact is null or char_length(contact) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists missing_residence_requests_student_idx on public.missing_residence_requests (student_profile_id);
alter table public.missing_residence_requests enable row level security;
revoke all on public.missing_residence_requests from anon, authenticated;

-- ==== 5. Contadores ATÓMICOS del OTP (service role solamente) ====
-- Sumar el intento en SQL ANTES de comparar evita la carrera de N intentos paralelos con el mismo código.
create or replace function public.consume_invite_otp_attempt(p_invitation_id uuid, p_max_code integer, p_max_total integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_left integer;
begin
  update public.resident_stay_invitations
     set otp_attempts = otp_attempts + 1, otp_code_attempts = otp_code_attempts + 1
   where id = p_invitation_id and used_at is null and revoked_at is null
     and otp_code_attempts < p_max_code and otp_attempts < p_max_total
  returning p_max_code - otp_code_attempts into v_left;
  return coalesce(v_left, -1);  -- -1 = bloqueado (por código o por total)
end $$;

create or replace function public.register_invite_otp_send(p_invitation_id uuid, p_max_sends integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.resident_stay_invitations
     set otp_send_count = otp_send_count + 1
   where id = p_invitation_id and used_at is null and revoked_at is null and otp_send_count < p_max_sends
  returning id into v_id;
  return v_id is not null;
end $$;

revoke all on function public.consume_invite_otp_attempt(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.register_invite_otp_send(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_invite_otp_attempt(uuid, integer, integer) to service_role;
grant execute on function public.register_invite_otp_send(uuid, integer) to service_role;

commit;

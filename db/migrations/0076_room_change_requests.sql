-- EstuRed — Migración 0076: cambio de habitación de un residente (DR34)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. Es ADITIVA e IDEMPOTENTE (create ... if not exists, drop policy if exists).
--    Necesita: `residences`, `room_types`, `beds`, `resident_stays`, `student_profiles`, `users`, `set_updated_at()` y
--    `is_residence_team_member()` (0058).
--    Hasta que se aplique, el código degrada con gracia: no aparece el pedido en «Mi residencia» ni la opción en Residentes, y las salidas /
--    cambios de cama / reactivaciones siguen como antes (la plaza liberada se repone sola, sin aviso previo).
--
-- DECISIÓN DEL DUEÑO (2026-11-03). Un residente (o su residencia, en su nombre) puede pedir cambiar de habitación DENTRO de la misma residencia,
-- con una preferencia (tipo, género, piso / nota libre) que sirve de FILTRO en Residentes. Cuando se libera una plaza que coincide con un pedido
-- pendiente, la residencia es avisada ANTES de que se publique como disponible y elige: ofrecérsela a ese residente, ignorar o publicarla.
-- Siempre sujeto a disponibilidad y a los costos que correspondan: EstuRed no cobra ni intermedia nada en este flujo (solo queda constancia del texto).
--
-- QUÉ HACE
--   1. `room_change_requests`: un pedido por estadía vigente (índice único parcial sobre los estados abiertos). Estados: `pending` (pendiente),
--      `offered` (en gestión / plaza ofrecida), `resolved` (resuelta), `cancelled` (cancelada). Origen: `student` o `residence`. Guarda la
--      preferencia (`preferred_room_type_id`, `preferred_gender`, `preference_note`), el motivo, la constancia del texto de costos que vio el
--      estudiante y, si se ofreció una plaza, la cama ofrecida.
--   2. `room_change_place_alerts`: «plaza liberada por decidir». Se crea SOLO cuando la plaza que se libera coincide con algún pedido pendiente
--      (el servidor lo calcula). Mientras está abierta (`pending` / `offered`) la plaza NO se publica sola. `deferred_increment` = true cuando
--      el +1 automático de disponibilidad del tipo (salida de un residente) quedó diferido hasta que la residencia decida.
--   3. RLS fail-closed: el equipo activo lee las de su residencia (función SECURITY DEFINER de la 0058, sin recursión) y el estudiante lee los
--      suyos. SIN policies de escritura (se revocan insert/update/delete): escribe solo el service role, desde server actions con permiso.
--      Grants por columna: no se exponen los `*_by_user_id`. Nada es público (anon sin acceso).
--
-- REVERTIR: drop table if exists public.room_change_place_alerts; drop table if exists public.room_change_requests;

begin;

do $$
begin
  if to_regclass('public.residences') is null or to_regclass('public.room_types') is null or to_regclass('public.beds') is null then
    raise exception '0076: faltan residences / room_types / beds';
  end if;
  if to_regclass('public.resident_stays') is null or to_regclass('public.student_profiles') is null then
    raise exception '0076: faltan resident_stays / student_profiles';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0076: falta la función set_updated_at';
  end if;
  if to_regprocedure('public.is_residence_team_member(uuid)') is null then
    raise exception '0076: falta is_residence_team_member (migración 0058)';
  end if;
end
$$;

create table if not exists public.room_change_requests (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  resident_stay_id uuid not null references public.resident_stays (id) on delete cascade,
  -- Nulo cuando la residencia lo carga para un residente que todavía no activó su cuenta.
  student_profile_id uuid references public.student_profiles (id) on delete cascade,
  origin text not null check (origin in ('student', 'residence')),
  status text not null default 'pending' check (status in ('pending', 'offered', 'resolved', 'cancelled')),
  -- Preferencia (todas opcionales, pero al menos una: lo valida el servidor). Nulo = «me da igual».
  preferred_room_type_id uuid references public.room_types (id) on delete set null,
  preferred_gender text check (preferred_gender is null or preferred_gender in ('masculino', 'femenino', 'mixto')),
  preference_note text check (preference_note is null or char_length(preference_note) <= 300),
  reason text check (reason is null or char_length(reason) <= 500),
  -- Constancia del texto de costos que vio el estudiante al pedir (no se cobra nada en este flujo).
  costs_notice_text text check (costs_notice_text is null or char_length(costs_notice_text) <= 1000),
  costs_acknowledged_at timestamptz,
  -- Plaza ofrecida (cuando la residencia se la ofrece a este residente desde un aviso de plaza liberada).
  offered_bed_id uuid references public.beds (id) on delete set null,
  offered_label text check (offered_label is null or char_length(offered_label) <= 120),
  offered_at timestamptz,
  offered_by_user_id uuid references public.users (id) on delete set null,
  -- Cierre.
  closed_reason text check (closed_reason is null or closed_reason in ('moved', 'resolved_by_residence', 'cancelled_by_student', 'cancelled_by_residence', 'stay_ended')),
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users (id) on delete set null,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un solo pedido abierto por estadía.
create unique index if not exists room_change_requests_one_open_per_stay
  on public.room_change_requests (resident_stay_id) where status in ('pending', 'offered');
create index if not exists room_change_requests_residence_status_idx on public.room_change_requests (residence_id, status);
create index if not exists room_change_requests_student_idx on public.room_change_requests (student_profile_id, created_at desc);

drop trigger if exists room_change_requests_updated_at on public.room_change_requests;
create trigger room_change_requests_updated_at before update on public.room_change_requests
  for each row execute function public.set_updated_at();

create table if not exists public.room_change_place_alerts (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  -- Nulos cuando se libera una plaza por tipo (residente sin cama asignada).
  bed_id uuid references public.beds (id) on delete cascade,
  room_type_id uuid references public.room_types (id) on delete set null,
  place_label text not null check (char_length(place_label) <= 160),
  gender text check (gender is null or gender in ('masculino', 'femenino', 'mixto', 'sin_especificar')),
  source text not null check (source in ('stay_ended', 'bed_move', 'bed_reactivated', 'room_reactivated')),
  status text not null default 'pending' check (status in ('pending', 'offered', 'published', 'ignored', 'resolved')),
  deferred_increment boolean not null default false,
  -- Estadía que dejó la plaza (para no avisarle a ese mismo residente de la plaza que acaba de dejar).
  freed_by_stay_id uuid references public.resident_stays (id) on delete set null,
  offered_request_id uuid references public.room_change_requests (id) on delete set null,
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una sola alerta abierta por cama.
create unique index if not exists room_change_place_alerts_one_open_per_bed
  on public.room_change_place_alerts (bed_id) where bed_id is not null and status in ('pending', 'offered');
create index if not exists room_change_place_alerts_residence_status_idx on public.room_change_place_alerts (residence_id, status);

drop trigger if exists room_change_place_alerts_updated_at on public.room_change_place_alerts;
create trigger room_change_place_alerts_updated_at before update on public.room_change_place_alerts
  for each row execute function public.set_updated_at();

alter table public.room_change_requests enable row level security;
alter table public.room_change_place_alerts enable row level security;

drop policy if exists room_change_requests_select_team on public.room_change_requests;
create policy room_change_requests_select_team on public.room_change_requests
  for select to authenticated using (public.is_residence_team_member(residence_id));

drop policy if exists room_change_requests_select_student on public.room_change_requests;
create policy room_change_requests_select_student on public.room_change_requests
  for select to authenticated using (
    student_profile_id in (select id from public.student_profiles where user_id = (select auth.uid()))
  );

drop policy if exists room_change_place_alerts_select_team on public.room_change_place_alerts;
create policy room_change_place_alerts_select_team on public.room_change_place_alerts
  for select to authenticated using (public.is_residence_team_member(residence_id));
-- Sin policies de insert/update/delete a propósito: solo el service role escribe.

-- Solo lectura desde la API y solo columnas sin autores internos. El código escribe y lee con el service role.
revoke all on public.room_change_requests from anon, authenticated;
grant select (
  id, residence_id, resident_stay_id, student_profile_id, origin, status, preferred_room_type_id, preferred_gender, preference_note, reason,
  costs_notice_text, costs_acknowledged_at, offered_bed_id, offered_label, offered_at, closed_reason, resolved_at, created_at, updated_at
) on public.room_change_requests to authenticated;

revoke all on public.room_change_place_alerts from anon, authenticated;
grant select (
  id, residence_id, bed_id, room_type_id, place_label, gender, source, status, deferred_increment, freed_by_stay_id, offered_request_id, resolved_at, created_at, updated_at
) on public.room_change_place_alerts to authenticated;

comment on table public.room_change_requests is 'DR34 (0076): pedido de cambio de habitación dentro de la misma residencia. Entidad separada de solicitud, renovación y «Quiero cambiar». Sin cobro. Escribe solo el service role.';
comment on table public.room_change_place_alerts is 'DR34 (0076): plaza liberada que coincide con un pedido pendiente; la residencia decide (ofrecer / ignorar / publicar) antes de publicarla. Escribe solo el service role.';

-- VERIFICACIÓN
--   select count(*) from public.room_change_requests;                       -- 0 al principio
--   select indexname from pg_indexes where tablename in ('room_change_requests', 'room_change_place_alerts');
--   -- como anon: debe dar "permission denied" →  select id from public.room_change_requests;

commit;

-- EstuRed — Migración 0044: aviso "Quiero cambiar" (Ciclo 59, decisión DR3)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado).
--    NO está aplicada. Es ADITIVA (no borra ni cambia nada existente) e IDEMPOTENTE (se puede correr dos veces).
--
-- MOTIVO. Decisión DR3 (docs/00 §31; docs/04 §5.6bis y §12bis; docs/06 §4.22, §14bis, §24.9, §27.11): un estudiante con
-- reserva vigente o estadía en curso puede avisarle a su residencia actual que busca otro lugar ("Quiero cambiar") y, mientras
-- el aviso esté abierto, solicitar y anotarse en listas de espera de OTRAS residencias aunque las fechas se superpongan con su
-- período vigente (excepción a DR1). Entidad nueva y SEPARADA: no es renovación, solicitud ni reserva.
--
-- QUÉ CREA
--   1. enum `stay_change_intent_status`: open, cancelled_by_student, resolved_new_reservation, expired (docs/06 §4.22) +
--      `pending_guardian_confirmation` (SUPUESTO REVERSIBLE, decisión del dueño sobre menores: el menor inicia el aviso pero NO
--      se le envía a la residencia hasta que su familiar vinculado lo confirma; mientras tanto la excepción a DR1 NO rige).
--   2. tabla `stay_change_intents` (docs/06 §14bis) + `resolved_new_start_date` (fecha de ingreso a la reserva nueva: es lo
--      ÚNICO que ve la residencia actual al resolverse, sin nombre de la residencia nueva), `student_edited_at` y
--      `residence_response_edit_count` (para mostrar "Actualizado el…"), `guardian_confirmed_*`, `terms_accepted_at`, `notice_started_at` y `payment_unlocked_at` (menores y preaviso de 48 h).
--      (Aclaración del dueño, 2026-10-23: se QUITÓ el interruptor `share_with_other_residences`; ver punto 3.)
--   3. `application_requests.stay_change_intent_id` y `waitlist_entries.stay_change_intent_id` (FK con ON DELETE SET NULL):
--      solicitudes y listas de espera creadas bajo la excepción, para poder cerrarlas al cancelar el aviso. Además son la
--      SEÑAL "en proceso de mudanza" que ve la residencia NUEVA (sin saber de qué residencia viene ni el motivo), y
--      `application_requests.move_context_note`: nota OPCIONAL y voluntaria del estudiante a ESA solicitud
--      ("desde dónde te mudás y por qué"), privada a esa residencia.
--   4. `residences.early_exit_deposit_clauses_text` / `early_exit_costs_text` / `early_exit_conditions_text`: política de
--      salida anticipada y cláusulas básicas del depósito, definidas UNA VEZ por la residencia en su perfil; son PÚBLICAS a
--      propósito (se muestran en la ficha antes de reservar y precargan la respuesta al aviso). "Hay depósito" se deriva de
--      `residences.deposit_usd` (ya existente).
--   5. tabla `stay_early_exits`: registro de la SALIDA ANTICIPADA que finaliza la residencia actual (`endResidentStay` con
--      motivo `early_exit`): fecha, estado de devolución del depósito (returned / not_returned / no_deposit), nota libre de la
--      residencia y nota del estudiante. La salida SIEMPRE la inicia la residencia; el estudiante no cierra su estadía.
--   6. RLS de `stay_change_intents` y `stay_early_exits` (ver abajo) e índices (docs/06 §24.9).
--
-- RLS (decisión de privacidad; docs/04 §12bis.4 "quién ve qué"):
--   - ESTUDIANTE dueño: SELECT de sus avisos.
--   - RESIDENCIA actual (owner/staff activos de `current_residence_id`): SELECT, pero NO ve los avisos en
--     `pending_guardian_confirmation` (un menor todavía no le avisó nada a nadie).
--   - Anon: nada. NINGUNA otra residencia: no existe policy para ellas sobre `stay_change_intents`; la residencia NUEVA solo
--     recibe la señal "en proceso de mudanza" a través de SU propia solicitud/lista (`stay_change_intent_id`, ver arriba).
--   - FAMILIAR vinculado: NO tiene policy directa a propósito. RLS filtra por FILA, no por columna, y el familiar NO debe ver
--     `student_message` (mensaje privado del estudiante a su residencia; decisión del dueño). Lo lee el servidor con service
--     role y una proyección sin ese campo (`loadFamilyStayChange`), tras verificar el vínculo activo.
--   - Escritura (INSERT/UPDATE/DELETE): solo service role (server actions). Se revoca explícitamente a anon/authenticated.
--   Las policies solo usan subconsultas a `student_profiles` / `residence_users` (como resident_stays, 0019), sin funciones
--   que consulten tablas con policies cruzadas, así que no hay riesgo de recursión de RLS.
--
-- VISIBILIDAD ENTRE RESIDENCIAS (aclaración del dueño, 2026-10-23, reemplaza el supuesto anterior): la residencia ACTUAL no
-- sabe a qué residencia se muda (solo la fecha de ingreso). La residencia NUEVA SÍ ve la señal "en proceso de mudanza" en su
-- bandeja/detalle (= `stay_change_intent_id` no nulo en SU solicitud o lista), pero no ve de qué residencia viene ni el motivo:
-- solo lo que el estudiante decida contarle en `move_context_note`. Que `application_requests`/`waitlist_entries` expongan
-- ese UUID opaco a la residencia consultada es, por lo tanto, intencional; no puede resolverlo (no accede a `stay_change_intents`).
--
-- REVERTIR: drop table public.stay_change_intents cascade; drop type public.stay_change_intent_status;
--   alter table public.application_requests drop column stay_change_intent_id;
--   alter table public.waitlist_entries drop column stay_change_intent_id;
--   alter table public.application_requests drop column move_context_note;
--   alter table public.waitlist_entries drop column move_context_note;
--   drop table public.stay_early_exits;
--   alter table public.residences drop column early_exit_costs_text, drop column early_exit_conditions_text, drop column early_exit_deposit_clauses_text;

-- ==== 1. Enum ====
do $$
begin
  create type public.stay_change_intent_status as enum (
    'pending_guardian_confirmation', 'open', 'cancelled_by_student', 'resolved_new_reservation', 'expired'
  );
exception when duplicate_object then null;
end $$;

-- ==== 2. Tabla ====
create table if not exists public.stay_change_intents (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles (id) on delete cascade,
  resident_stay_id uuid references public.resident_stays (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete cascade,
  current_residence_id uuid not null references public.residences (id) on delete cascade,
  status public.stay_change_intent_status not null default 'open',
  estimated_exit_date date,
  student_message text,
  -- Respuesta de la residencia actual (informativa; EstuRed no fija, cobra ni garantiza estos costos).
  residence_response_message text,
  residence_exit_costs_text text,
  residence_exit_costs_usd numeric(14, 2),
  residence_exit_conditions_text text,
  residence_exit_details_text text,
  residence_responded_at timestamptz,
  residence_responded_by_user_id uuid references public.users (id),
  residence_response_edit_count integer not null default 0,
  response_seen_by_student_at timestamptz,
  student_edited_at timestamptz,
  -- Aceptación explícita de las reglas del aviso (checkbox obligatorio) y menores (docs/06 §14bis.1).
  terms_accepted_at timestamptz not null default now(),
  created_by_minor boolean not null default false,
  -- Preaviso (supuesto reversible): arranca al avisar (menores: al confirmar el familiar); una reserva nueva no avanza a pago
  -- antes de `payment_unlocked_at` = notice_started_at + 48 h. Nulos mientras está pending_guardian_confirmation.
  notice_started_at timestamptz,
  payment_unlocked_at timestamptz,
  -- Menores: confirmación del familiar vinculado (supuesto reversible; ver cabecera).
  guardian_confirmed_at timestamptz,
  guardian_confirmed_by_user_id uuid references public.users (id),
  -- Cierre.
  resolved_reservation_id uuid references public.reservations (id) on delete set null,
  resolved_new_start_date date,
  resolved_at timestamptz,
  expires_at timestamptz,
  last_keep_alive_notified_at timestamptz,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stay_change_intents_stay_or_reservation check (resident_stay_id is not null or reservation_id is not null),
  constraint stay_change_intents_message_len check (student_message is null or char_length(student_message) <= 500),
  constraint stay_change_intents_response_len check (
    (residence_response_message is null or char_length(residence_response_message) <= 1000)
    and (residence_exit_costs_text is null or char_length(residence_exit_costs_text) <= 1000)
    and (residence_exit_conditions_text is null or char_length(residence_exit_conditions_text) <= 1000)
    and (residence_exit_details_text is null or char_length(residence_exit_details_text) <= 1000)
  ),
  constraint stay_change_intents_costs_usd_range check (
    residence_exit_costs_usd is null or (residence_exit_costs_usd >= 0 and residence_exit_costs_usd <= 100000)
  )
);

drop trigger if exists stay_change_intents_updated_at on public.stay_change_intents;
create trigger stay_change_intents_updated_at before update on public.stay_change_intents
  for each row execute function public.set_updated_at();

-- Un solo aviso vigente por estudiante (docs/06 §24.9). Incluye `pending_guardian_confirmation`: un menor no puede tener
-- dos avisos en paralelo (uno pendiente y otro abierto).
create unique index if not exists stay_change_intents_one_active_per_student
  on public.stay_change_intents (student_profile_id)
  where status in ('open', 'pending_guardian_confirmation');
create index if not exists stay_change_intents_residence_status_idx
  on public.stay_change_intents (current_residence_id, status);
create index if not exists stay_change_intents_student_idx
  on public.stay_change_intents (student_profile_id, created_at desc);
create index if not exists stay_change_intents_expires_idx
  on public.stay_change_intents (expires_at)
  where status in ('open', 'pending_guardian_confirmation');

comment on table public.stay_change_intents is
  'DR3 (Ciclo 59): aviso "Quiero cambiar" de un estudiante alojado. Entidad separada de renovación/solicitud/reserva. RLS: estudiante dueño y staff de la residencia actual (sin pendientes de familiar); sin policy para familiar ni otras residencias (lectura server-side con proyección). Escritura solo service role. El preaviso corre desde created_at (menores: guardian_confirmed_at); una reserva nueva no puede avanzar a pago antes de 48 h (supuesto reversible).';
comment on column public.stay_change_intents.resolved_new_start_date is
  'Fecha de ingreso a la reserva nueva: lo único que ve la residencia actual al resolverse (sin el nombre de la residencia nueva).';

-- ==== 3. RLS ====
alter table public.stay_change_intents enable row level security;

drop policy if exists stay_change_intents_select_student on public.stay_change_intents;
create policy stay_change_intents_select_student on public.stay_change_intents
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );

drop policy if exists stay_change_intents_select_residence on public.stay_change_intents;
create policy stay_change_intents_select_residence on public.stay_change_intents
  for select to authenticated using (
    status <> 'pending_guardian_confirmation'
    and current_residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

-- Sin policies de INSERT/UPDATE/DELETE: solo el service role (server actions) escribe. Defensa en profundidad:
revoke all on public.stay_change_intents from anon;
revoke insert, update, delete, truncate on public.stay_change_intents from authenticated;

-- ==== 4. Vínculo de solicitudes y listas de espera con el aviso ====
alter table public.application_requests
  add column if not exists stay_change_intent_id uuid references public.stay_change_intents (id) on delete set null;
alter table public.waitlist_entries
  add column if not exists stay_change_intent_id uuid references public.stay_change_intents (id) on delete set null;

alter table public.application_requests
  add column if not exists move_context_note text;
alter table public.waitlist_entries
  add column if not exists move_context_note text;
alter table public.application_requests drop constraint if exists application_requests_move_note_len;
alter table public.application_requests add constraint application_requests_move_note_len
  check (move_context_note is null or char_length(move_context_note) <= 500);
alter table public.waitlist_entries drop constraint if exists waitlist_entries_move_note_len;
alter table public.waitlist_entries add constraint waitlist_entries_move_note_len
  check (move_context_note is null or char_length(move_context_note) <= 500);
comment on column public.application_requests.move_context_note is
  'DR3: nota voluntaria del estudiante a la residencia NUEVA ("desde dónde te mudás y por qué"). Privada a esta solicitud; solo con stay_change_intent_id.';

create index if not exists application_requests_stay_change_intent_idx
  on public.application_requests (stay_change_intent_id) where stay_change_intent_id is not null;
create index if not exists waitlist_entries_stay_change_intent_idx
  on public.waitlist_entries (stay_change_intent_id) where stay_change_intent_id is not null;

-- ==== 5. Política de salida anticipada de la residencia (pública: se muestra en la ficha) ====
alter table public.residences
  add column if not exists early_exit_deposit_clauses_text text,
  add column if not exists early_exit_costs_text text,
  add column if not exists early_exit_conditions_text text;

alter table public.residences drop constraint if exists residences_early_exit_len;
alter table public.residences add constraint residences_early_exit_len check (
  (early_exit_deposit_clauses_text is null or char_length(early_exit_deposit_clauses_text) <= 1000)
  and (early_exit_costs_text is null or char_length(early_exit_costs_text) <= 1000)
  and (early_exit_conditions_text is null or char_length(early_exit_conditions_text) <= 1000)
);

comment on column public.residences.early_exit_deposit_clauses_text is
  'DR3: cláusulas básicas del depósito (derechos y obligaciones de las partes), definidas por la residencia en su configuración inicial. Público (ficha). Informativo: EstuRed no las fija ni media.';
comment on column public.residences.early_exit_costs_text is
  'DR3: costos de salida anticipada que la residencia define una vez en su perfil (p. ej. pérdida del depósito si no cumplió la estadía mínima). Público (ficha); precarga la respuesta a un aviso "Quiero cambiar". Informativo: EstuRed no lo fija ni lo cobra.';
comment on column public.residences.early_exit_conditions_text is
  'DR3: condiciones de salida anticipada (preaviso, entrega de la habitación, etc.). Público (ficha); precarga la respuesta.';

-- ==== 6. Salida anticipada registrada por la residencia actual ====
create table if not exists public.stay_early_exits (
  id uuid primary key default gen_random_uuid(),
  resident_stay_id uuid not null unique references public.resident_stays (id) on delete cascade,
  residence_id uuid not null references public.residences (id) on delete cascade,
  student_profile_id uuid references public.student_profiles (id) on delete cascade,
  stay_change_intent_id uuid references public.stay_change_intents (id) on delete set null,
  exit_type text not null default 'early_exit' check (exit_type in ('early_exit')),
  exit_date date not null,
  -- returned / not_returned (había depósito) | no_deposit (la reserva no tenía depósito).
  deposit_status text not null check (deposit_status in ('returned', 'not_returned', 'no_deposit')),
  deposit_usd numeric(14, 2),
  residence_note text,
  student_note text,
  student_note_updated_at timestamptz,
  recorded_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stay_early_exits_notes_len check (
    (residence_note is null or char_length(residence_note) <= 2000)
    and (student_note is null or char_length(student_note) <= 1000)
  )
);
drop trigger if exists stay_early_exits_updated_at on public.stay_early_exits;
create trigger stay_early_exits_updated_at before update on public.stay_early_exits
  for each row execute function public.set_updated_at();
create index if not exists stay_early_exits_residence_idx on public.stay_early_exits (residence_id, created_at desc);
create index if not exists stay_early_exits_student_idx on public.stay_early_exits (student_profile_id);

-- RLS: estudiante dueño y staff de la residencia. Sin policy para familiar (las notas son privadas) ni anon.
-- Escritura solo service role.
alter table public.stay_early_exits enable row level security;
drop policy if exists stay_early_exits_select_student on public.stay_early_exits;
create policy stay_early_exits_select_student on public.stay_early_exits
  for select to authenticated using (
    student_profile_id in (select id from public.student_profiles where user_id = (select auth.uid()))
  );
drop policy if exists stay_early_exits_select_residence on public.stay_early_exits;
create policy stay_early_exits_select_residence on public.stay_early_exits
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );
revoke all on public.stay_early_exits from anon;
revoke insert, update, delete, truncate on public.stay_early_exits from authenticated;
comment on table public.stay_early_exits is
  'DR3: salida anticipada registrada por la residencia actual (nunca por el estudiante). Deja asentada la devolución del depósito y las notas libres de ambas partes. EstuRed no media ni garantiza cobros.';

-- ==== Verificación (correr aparte, después del Run) ====
-- 1) Debe devolver 1 fila con las 5 etiquetas del enum:
--    select enum_range(null::public.stay_change_intent_status);
-- 2) Debe devolver 8 filas (vínculo en 2 tablas + nota de mudanza en 2 tablas + 3 de política en residences):
--    select table_name, column_name from information_schema.columns
--    where table_schema = 'public'
--      and ((table_name in ('application_requests', 'waitlist_entries') and column_name = 'stay_change_intent_id')
--        or (table_name in ('application_requests', 'waitlist_entries') and column_name = 'move_context_note')
--        or (table_name = 'residences' and column_name in ('early_exit_deposit_clauses_text', 'early_exit_costs_text', 'early_exit_conditions_text')))
--    order by 1, 2;
-- 3) Debe devolver rowsecurity = true y 2 policies por tabla (select_student, select_residence):
--    select relname, relrowsecurity from pg_class where oid in ('public.stay_change_intents'::regclass, 'public.stay_early_exits'::regclass);
--    select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename in ('stay_change_intents', 'stay_early_exits');
-- 4) Debe devolver 4 índices propios + el PK:
--    select indexname from pg_indexes where schemaname = 'public' and tablename = 'stay_change_intents';
-- 5) anon no debe poder leer (esperado: error 42501 o 0 filas):
--    set role anon; select count(*) from public.stay_change_intents; select count(*) from public.stay_early_exits; reset role;

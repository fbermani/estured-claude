-- 0025 — Condiciones de reserva a nivel residencia + camas físicas
-- (Ciclo 34duovicies). Decisiones explícitas del dueño (2026-07-17,
-- vía AskUserQuestion, siguiendo la referencia
-- `estured_configuraci_n_de_residencia_onboarding`):
--
--  1. Matrícula, depósito, mes vacío, política de ajuste y estadía
--     mínima pasan de `room_types` a `residences` — son condiciones
--     GENERALES de la residencia, iguales para todos los tipos.
--     ⚠️ Esto diverge de docs/06 §9.1 (que las modela por tipo):
--     el dueño debe actualizar ese doc (protocolo docs/13 §5) — el
--     cambio quedó registrado en MEMORY.md.
--  2. Camas individuales (`beds`): cada habitación tiene camas con
--     letra (A, B, C…) y estado propio (activa / fuera de servicio
--     con razón), como el modal `estured_admin_gesti_n_de_habitaciones`.
--  3. `resident_stays` gana `bed_id` (asignación a cama puntual),
--     `expected_end_date` ("contrato hasta" / salida exacta) y
--     `monthly_rate_usd` (tarifa del residente — por defecto la del
--     tipo, editable por la residencia como en el modal de perfil).
--
-- Reglas de la referencia que se vuelven constraints:
--  - Depósito EXCLUYENTE con matrícula (no pueden coexistir).
--  - Matrícula: "equivalente a 1 mes" o valor manual; única vez o anual.
--  - Mes vacío: % de la renta cobrado por mes completo entre la
--    solicitud y el ingreso, con tope de 3 meses (el tope se aplica en
--    el cálculo, no acá).

-- ==== residences: condiciones de reserva ====
alter table public.residences
  add column minimum_stay_months integer
    check (minimum_stay_months is null or minimum_stay_months between 1 and 24),
  add column adjustment_policy text not null default 'quarterly'
    check (adjustment_policy in ('monthly', 'quarterly', 'semiannual', 'annual', 'none')),
  add column enrollment_fee_mode text
    check (enrollment_fee_mode in ('one_month', 'manual')),
  add column enrollment_fee_usd numeric(14, 2)
    check (enrollment_fee_usd is null or enrollment_fee_usd >= 0),
  add column enrollment_fee_frequency text not null default 'once'
    check (enrollment_fee_frequency in ('once', 'annual')),
  add column deposit_usd numeric(14, 2)
    check (deposit_usd is null or deposit_usd >= 0),
  add column empty_month_charge_percent numeric(5, 2)
    check (empty_month_charge_percent is null
      or (empty_month_charge_percent >= 0 and empty_month_charge_percent <= 100)),
  -- Referencia: "Depósito de Garantía — Excluyente con Matrícula".
  add constraint residences_deposit_xor_enrollment
    check (not (deposit_usd is not null and enrollment_fee_mode is not null)),
  -- Modo manual requiere monto; modo "1 mes" no lleva monto propio.
  add constraint residences_enrollment_amount_coherent
    check (
      enrollment_fee_mode is distinct from 'manual' or enrollment_fee_usd is not null
    );

-- ==== migración de datos: por residencia, desde sus room_types ====
-- Matrícula gana sobre depósito si una residencia tenía ambos (regla
-- nueva de exclusión); ajuste/estadía mínima: el valor más común.
update public.residences r
set
  adjustment_policy = coalesce(
    (select rt.adjustment_policy from public.room_types rt
     where rt.residence_id = r.id and rt.adjustment_policy is not null
     group by rt.adjustment_policy order by count(*) desc limit 1),
    'quarterly'
  ),
  minimum_stay_months = (
    select min(rt.minimum_stay_months) from public.room_types rt
    where rt.residence_id = r.id and rt.minimum_stay_months is not null
  ),
  enrollment_fee_mode = case
    when exists (select 1 from public.room_types rt
                 where rt.residence_id = r.id and rt.enrollment_fee_usd is not null)
    then 'manual' else null end,
  enrollment_fee_usd = (
    select max(rt.enrollment_fee_usd) from public.room_types rt
    where rt.residence_id = r.id
  ),
  deposit_usd = case
    when exists (select 1 from public.room_types rt
                 where rt.residence_id = r.id and rt.enrollment_fee_usd is not null)
    then null
    else (select max(rt.deposit_usd) from public.room_types rt
          where rt.residence_id = r.id) end,
  empty_month_charge_percent = (
    select max(rt.empty_month_charge_percent) from public.room_types rt
    where rt.residence_id = r.id
  );

-- ==== room_types: se retiran las condiciones ahora generales ====
alter table public.room_types
  drop column enrollment_fee_usd,
  drop column enrollment_fee_ars,
  drop column deposit_usd,
  drop column deposit_ars,
  drop column deposit_is_refundable,
  drop column adjustment_policy,
  drop column minimum_stay_months,
  drop column empty_month_charge_percent;

-- ==== beds ====
create table public.beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  letter text not null,            -- "A", "B", "C"…
  status text not null default 'active'
    check (status in ('active', 'out_of_service')),
  out_of_service_reason text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, letter)
);
create trigger beds_updated_at before update on public.beds
  for each row execute function public.set_updated_at();
create index beds_room_idx on public.beds (room_id, sort_order);

-- Mismo patrón que rooms: RLS sin policies, solo service role.
alter table public.beds enable row level security;

-- ==== resident_stays: cama, salida esperada y tarifa propia ====
alter table public.resident_stays
  add column bed_id uuid references public.beds (id),
  add column expected_end_date date,
  add column monthly_rate_usd numeric(14, 2)
    check (monthly_rate_usd is null or monthly_rate_usd >= 0);
create index resident_stays_bed_idx on public.resident_stays (bed_id);

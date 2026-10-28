-- EstuRed — Migración 0060: dinero — pago inicial solo matrícula, descuento de matrícula, depósito con opciones y promociones (DR18, fase 2, tanda 3)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada en producción.
--    ADITIVA e IDEMPOTENTE; no toca filas existentes (todo lo nuevo es null / default). Necesita: `residences`, `application_snapshots`,
--    `room_types`, `users` y `set_updated_at()`. Hasta que se aplique, el código degrada con gracia (todo se lee como antes de la tanda 3).
--
-- QUÉ HACE
--   1. `residences.reservation_initial_payment_mode` acepta además 'enrollment_only' (pago inicial = solo la matrícula vigente).
--   2. `residences.enrollment_discount_percent` (0–100) y `enrollment_discount_until` (fecha opcional): descuento de matrícula.
--   3. `residences.deposit_mode` ('half_month' | 'one_month' | 'two_months'; null = monto fijo en `deposit_usd`). Excluyente con la
--      matrícula igual que `deposit_usd` (0025) y con `deposit_usd`.
--   4. `residence_promotions`: promociones de tarifa con vigencia, sin tocar las tarifas de lista. RLS sin policies (solo service role,
--      desde server actions con permiso `profile.edit`); se revocan grants de anon/authenticated. Sin funciones SECURITY DEFINER.
--   5. `application_snapshots`: columnas de «antes/ahora» (`list_monthly_price_usd`, `promotion_percent`, `promotion_id`,
--      `enrollment_fee_list_usd`, `enrollment_fee_discount_percent`). `monthly_price_usd` y `enrollment_fee_usd` siguen siendo lo que
--      paga el estudiante (base del fee): ningún lector existente cambia.
--
-- REVERTIR (en este orden):
--   alter table public.application_snapshots drop column if exists promotion_id, drop column if exists promotion_percent,
--     drop column if exists list_monthly_price_usd, drop column if exists enrollment_fee_list_usd,
--     drop column if exists enrollment_fee_discount_percent;
--   drop table if exists public.residence_promotions;
--   (más los drop constraint / drop column de `residences` de abajo; antes pasar filas 'enrollment_only' a 'one_month')

begin;

do $$
begin
  if to_regclass('public.residences') is null or to_regclass('public.application_snapshots') is null
     or to_regclass('public.room_types') is null or to_regclass('public.users') is null then
    raise exception '0060: faltan residences / application_snapshots / room_types / users';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0060: falta la función set_updated_at';
  end if;
end
$$;

-- 1) Pago inicial: nuevo modo 'enrollment_only' (sin monto fijo, como 'one_month').
alter table public.residences drop constraint if exists residences_initial_payment_mode_check;
alter table public.residences add constraint residences_initial_payment_mode_check
  check (reservation_initial_payment_mode in ('one_month', 'custom_usd', 'enrollment_only'));

alter table public.residences drop constraint if exists residences_initial_payment_coherent;
alter table public.residences add constraint residences_initial_payment_coherent check (
  (reservation_initial_payment_mode in ('one_month', 'enrollment_only') and reservation_initial_payment_usd is null)
  or
  (reservation_initial_payment_mode = 'custom_usd'
    and reservation_initial_payment_usd is not null
    and reservation_initial_payment_usd > 0)
);

-- 2) Descuento de matrícula.
alter table public.residences
  add column if not exists enrollment_discount_percent numeric(5, 2),
  add column if not exists enrollment_discount_until date;

alter table public.residences drop constraint if exists residences_enrollment_discount_range;
alter table public.residences add constraint residences_enrollment_discount_range check (
  enrollment_discount_percent is null or (enrollment_discount_percent > 0 and enrollment_discount_percent <= 100)
);
alter table public.residences drop constraint if exists residences_enrollment_discount_needs_fee;
alter table public.residences add constraint residences_enrollment_discount_needs_fee check (
  enrollment_discount_percent is null or enrollment_fee_mode is not null
);
alter table public.residences drop constraint if exists residences_enrollment_discount_until_needs_percent;
alter table public.residences add constraint residences_enrollment_discount_until_needs_percent check (
  enrollment_discount_until is null or enrollment_discount_percent is not null
);

-- 3) Depósito con opciones.
alter table public.residences add column if not exists deposit_mode text;

alter table public.residences drop constraint if exists residences_deposit_mode_check;
alter table public.residences add constraint residences_deposit_mode_check
  check (deposit_mode is null or deposit_mode in ('half_month', 'one_month', 'two_months'));
alter table public.residences drop constraint if exists residences_deposit_mode_exclusive;
alter table public.residences add constraint residences_deposit_mode_exclusive check (
  deposit_mode is null or (deposit_usd is null and enrollment_fee_mode is null)
);

comment on column public.residences.reservation_initial_payment_mode is
  'D7/H08 + DR18: pago inicial para reservar a la residencia. one_month = primer mes (default); custom_usd = monto fijo; enrollment_only = solo la matrícula vigente (cae al primer mes si no hay matrícula).';
comment on column public.residences.enrollment_discount_percent is
  'DR18 t3: descuento de matrícula (1–100). La matrícula neta se congela en el snapshot; el fee se calcula sobre ella.';
comment on column public.residences.enrollment_discount_until is
  'DR18 t3: último día (inclusive) en que rige el descuento de matrícula; null = sin fecha de fin.';
comment on column public.residences.deposit_mode is
  'DR18 t3: depósito en meses de renta de lista (half_month | one_month | two_months); null = monto fijo en deposit_usd.';

-- 4) Promociones de tarifa.
create table if not exists public.residence_promotions (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  room_type_id uuid references public.room_types (id) on delete cascade,
  label text not null check (char_length(label) between 2 and 60),
  discount_percent numeric(5, 2) not null check (discount_percent >= 1 and discount_percent <= 90),
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint residence_promotions_dates_ordered check (ends_on is null or ends_on >= starts_on)
);

drop trigger if exists residence_promotions_updated_at on public.residence_promotions;
create trigger residence_promotions_updated_at before update on public.residence_promotions
  for each row execute function public.set_updated_at();

create index if not exists residence_promotions_residence_idx
  on public.residence_promotions (residence_id, is_active, starts_on);

alter table public.residence_promotions enable row level security;
revoke all on public.residence_promotions from anon, authenticated;

comment on table public.residence_promotions is
  'DR18 t3: promociones de tarifa con vigencia. RLS sin policies: solo service role. No modifica las tarifas de lista.';

-- 5) Snapshot: «antes/ahora» (no cambian monthly_price_usd ni enrollment_fee_usd, que son lo que paga el estudiante).
alter table public.application_snapshots
  add column if not exists list_monthly_price_usd numeric(14, 2),
  add column if not exists promotion_percent numeric(5, 2),
  add column if not exists promotion_id uuid references public.residence_promotions (id) on delete set null,
  add column if not exists enrollment_fee_list_usd numeric(14, 2),
  add column if not exists enrollment_fee_discount_percent numeric(5, 2);

commit;

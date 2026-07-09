-- EstuRed — Migración 0010: pago a residencia + creación de reserva
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §12 (pago a residencia) y §13.1-13.2
-- (reservas, fee EstuRed), docs/03 §12.4-12.5, docs/07 §16, docs/04 §5.4.
--
-- Alcance de esta migración (decisión de fase, docs/00 §7 "nunca fusionar
-- pago a residencia / fee / reserva / comprobante"): se crean las 3
-- tablas completas del loop (incluye columnas de cobro real y factura
-- fiscal de `estured_fee_payments`, docs/06 §13.2) porque `reservations`
-- ya las referencia — más simple crear el esquema entero ahora que
-- extenderlo en una migración aparte (mismo criterio que la 0007 con el
-- enum `application_status`). La FASE de código de esta migración solo
-- llega hasta CREAR estas filas (`estured_fee_payments` en
-- `pending_payment_method`, sin cobro); el cobro real (MercadoPago/PayU),
-- webhooks y factura fiscal (TusFacturas.app) son la fase siguiente.

create type public.external_residence_payment_status as enum (
  'not_required_yet', 'pending', 'student_reference_uploaded',
  'reported_received_by_residence', 'expired', 'disputed'
);

create type public.reservation_status as enum (
  'pending_estured_fee', 'estured_fee_processing', 'estured_fee_failed',
  'expired_fee_unpaid', 'confirmed', 'receipt_pending', 'receipt_issued',
  'cancelled_by_student', 'cancelled_by_residence', 'no_show', 'completed', 'disputed'
);

create type public.estured_fee_status as enum (
  'not_required_yet', 'pending_payment_method', 'pending_manual_payment',
  'pending_auto_charge', 'processing', 'paid', 'failed', 'expired', 'refunded', 'chargeback'
);

create type public.payment_provider as enum ('mercado_pago', 'payu_argentina', 'manual', 'other');

create type public.fiscal_invoice_status as enum (
  'not_required', 'pending_issue', 'issued', 'issue_failed', 'voided', 'reissued'
);

-- ==== external_residence_payments (docs/06 §12.1) ====
-- Se crea sin FK a reservations (circular — reservations la referencia
-- a ella). Se agrega al final, mismo patrón que la 0007 con snapshots.
create table public.external_residence_payments (
  id uuid primary key default gen_random_uuid(),
  application_request_id uuid not null references public.application_requests (id) on delete cascade,
  reservation_id uuid,
  residence_id uuid not null references public.residences (id),
  student_profile_id uuid not null references public.student_profiles (id),
  status public.external_residence_payment_status not null default 'pending',
  amount_reported_usd numeric(14, 2),
  amount_reported_ars numeric(14, 2),
  payment_concept text,
  payment_method_to_residence text,
  student_proof_file_id uuid references public.files (id),
  residence_receipt_file_id uuid references public.files (id),
  reported_received_by_user_id uuid references public.users (id),
  reported_received_at timestamptz,
  mark_received_consent_id uuid references public.consents (id),
  dispute_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_request_id) -- docs/06 §13.1: 1:0..1 con application_requests
);
create trigger external_residence_payments_updated_at before update on public.external_residence_payments
  for each row execute function public.set_updated_at();
create index external_residence_payments_request_idx on public.external_residence_payments (application_request_id);
create index external_residence_payments_residence_idx on public.external_residence_payments (residence_id);

-- ==== reservations (docs/06 §13.1) ====
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  application_request_id uuid not null references public.application_requests (id),
  student_profile_id uuid not null references public.student_profiles (id),
  family_link_id uuid references public.family_links (id),
  residence_id uuid not null references public.residences (id),
  room_type_id uuid not null references public.room_types (id),
  place_id uuid,
  status public.reservation_status not null default 'pending_estured_fee',
  start_date date not null,
  initial_duration_months integer not null,
  academic_objective text not null,
  snapshot_id uuid not null references public.application_snapshots (id),
  external_residence_payment_id uuid not null references public.external_residence_payments (id),
  estured_fee_payment_id uuid,
  booking_receipt_id uuid,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason_code text,
  no_show_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();
create index reservations_application_idx on public.reservations (application_request_id);
create index reservations_student_idx on public.reservations (student_profile_id);
create index reservations_residence_idx on public.reservations (residence_id);

alter table public.external_residence_payments
  add constraint external_residence_payments_reservation_fk
  foreign key (reservation_id) references public.reservations (id);

-- ==== estured_fee_payments (docs/06 §13.2) ====
-- Fase de código de esta migración: solo INSERT en `markResidencePaymentReceived`
-- (server action), status inicial `pending_payment_method`. Cobro real,
-- webhooks y factura fiscal quedan para el ciclo siguiente.
create table public.estured_fee_payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.reservations (id),
  renewal_offer_id uuid,
  payer_user_id uuid not null references public.users (id),
  beneficiary_student_profile_id uuid not null references public.student_profiles (id),
  status public.estured_fee_status not null default 'pending_payment_method',
  fee_rate_percent numeric(5, 2) not null default 5.00,
  fee_base_usd numeric(14, 2) not null,
  fee_base_ars numeric(14, 2) not null,
  fee_amount_ars numeric(14, 2) not null,
  fee_amount_usd numeric(14, 2),
  payment_currency text not null default 'ARS' check (payment_currency in ('ARS', 'USD')),
  payment_provider public.payment_provider,
  provider_payment_id text,
  provider_payload jsonb,
  idempotency_key text unique,
  manual_payment_file_id uuid references public.files (id),
  attempt_count integer not null default 0,
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  paid_at timestamptz,
  expires_at timestamptz not null,
  refunded_at timestamptz,
  refund_reason text,
  fiscal_invoice_status public.fiscal_invoice_status not null default 'not_required',
  fiscal_invoice_id text,
  fiscal_invoice_number text,
  fiscal_invoice_issued_at timestamptz,
  fiscal_invoice_file_id uuid references public.files (id),
  fiscal_invoice_retry_count integer not null default 0,
  fiscal_invoice_last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estured_fee_payments_target_check check (
    (reservation_id is not null and renewal_offer_id is null) or
    (reservation_id is null and renewal_offer_id is not null)
  )
);
create trigger estured_fee_payments_updated_at before update on public.estured_fee_payments
  for each row execute function public.set_updated_at();
create index estured_fee_payments_reservation_idx on public.estured_fee_payments (reservation_id);

alter table public.reservations
  add constraint reservations_estured_fee_payment_fk
  foreign key (estured_fee_payment_id) references public.estured_fee_payments (id);

-- ==== Row Level Security ====
-- Mismo patrón de subquery que negotiation_proposals (migración 0008),
-- reutiliza is_family_member_of_student() para evitar recursión de RLS.

alter table public.external_residence_payments enable row level security;
create policy external_residence_payments_select_related on public.external_residence_payments
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
    or public.is_family_member_of_student(student_profile_id)
    or residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

alter table public.reservations enable row level security;
create policy reservations_select_related on public.reservations
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
    or public.is_family_member_of_student(student_profile_id)
    or residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

alter table public.estured_fee_payments enable row level security;
create policy estured_fee_payments_select_related on public.estured_fee_payments
  for select to authenticated using (
    beneficiary_student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
    or public.is_family_member_of_student(beneficiary_student_profile_id)
    or reservation_id in (
      select id from public.reservations where residence_id in (
        select residence_id from public.residence_users
        where user_id = (select auth.uid()) and is_active = true
      )
    )
  );

comment on table public.external_residence_payments is
  'Pago del estudiante a la residencia, fuera de EstuRed (docs/03 §12.4-12.5). Solo la residencia marca "recibido".';
comment on table public.reservations is
  'Se crea al marcar el pago a residencia como recibido. A partir de acá esta entidad controla el estado (docs/06 §13.1).';
comment on table public.estured_fee_payments is
  'Fee EstuRed (5% fijo, docs/00 §12). Esta migración solo crea la fila en pending_payment_method — el cobro real es la fase siguiente.';

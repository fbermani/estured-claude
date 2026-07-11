-- EstuRed — Migración 0016: módulo de Renovaciones (Fase 1)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/12_BUILD_PLAN.md §13 (Must Have del MVP, no construido
-- hasta ahora — solo existía la columna placeholder
-- estured_fee_payments.renewal_offer_id, migración 0010), docs/04
-- §12 (máquina de estados), docs/06 §14 (modelo de datos), docs/05
-- §14 (permisos), docs/03 §16.5 (fórmula del fee, idéntica a la
-- reserva inicial).
--
-- Alcance de esta migración (Ciclo 30, fase 1 del módulo): schema
-- completo per docs/06 §14.1-14.3 (incluye las columnas de pago/fee/
-- comprobante aunque todavía no se pueblen — se construyen en la fase
-- 2, igual que estured_fee_payments incluyó `renewal_offer_id` desde
-- la migración 0010 sin que renewal_offers existiera todavía). Esta
-- fase cubre: solicitud del estudiante → oferta formal de la
-- residencia (borrador o enviada) → aceptar/rechazar. NO cubre pago a
-- residencia, fee EstuRed, comprobante, ni la extensión de
-- `resident_stays` al confirmar (esa tabla tampoco existe todavía —
-- gap separado, no de este módulo, ver MEMORY.md).
--
-- Supuestos reversibles documentados (docs/13 §4 — vacíos reales que
-- ningún doc resuelve, confirmados por investigación exhaustiva antes
-- de esta migración):
--   1. Sin plazo mínimo de días antes del fin del período actual para
--      poder solicitar renovación — no se aplica restricción.
--   2. Sin SLA de respuesta de la residencia a una renewal_request, ni
--      job de auto-cierre por inactividad — queda pendiente (mismo
--      nivel de madurez que otros jobs diferidos del proyecto).
--   3. Sin job que venza `renewal_offer_status` al pasar
--      `acceptance_deadline_at` — el campo se guarda pero no se
--      procesa automáticamente todavía (pendiente, fase futura).

create type public.renewal_request_status as enum (
  'created_by_student', 'notified_to_residence', 'offer_received',
  'closed_no_offer', 'superseded_by_offer'
);

create type public.renewal_offer_status as enum (
  'draft', 'sent', 'viewed', 'accepted_by_student', 'rejected_by_student',
  'expired', 'expired_no_student_payment', 'residence_payment_pending',
  'residence_payment_reported', 'estured_fee_pending', 'estured_fee_processing',
  'confirmed', 'receipt_pending', 'receipt_issued', 'cancelled_by_residence',
  'cancelled_by_student', 'disputed'
);

-- ==== renewal_requests (docs/06 §14.1) — solicitud informal, no vinculante ====
create table public.renewal_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id),
  student_profile_id uuid not null references public.student_profiles (id),
  residence_id uuid not null references public.residences (id),
  message text,
  desired_duration_months integer,
  status public.renewal_request_status not null default 'created_by_student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger renewal_requests_updated_at before update on public.renewal_requests
  for each row execute function public.set_updated_at();
create index renewal_requests_reservation_idx on public.renewal_requests (reservation_id);
create index renewal_requests_residence_idx on public.renewal_requests (residence_id);
create index renewal_requests_student_idx on public.renewal_requests (student_profile_id);

-- ==== renewal_offers (docs/06 §14.2) — oferta formal de la residencia ====
create table public.renewal_offers (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id),
  renewal_request_id uuid references public.renewal_requests (id),
  student_profile_id uuid not null references public.student_profiles (id),
  residence_id uuid not null references public.residences (id),
  status public.renewal_offer_status not null default 'draft',
  period_start_date date not null,
  period_end_date date not null,
  duration_months integer not null check (duration_months > 0),
  monthly_price_usd numeric(14,2) not null check (monthly_price_usd > 0),
  monthly_price_ars numeric(14,2) not null check (monthly_price_ars > 0),
  enrollment_or_renewal_fee_usd numeric(14,2),
  enrollment_or_renewal_fee_ars numeric(14,2),
  deposit_usd numeric(14,2),
  deposit_ars numeric(14,2),
  adjustment_policy text not null
    check (adjustment_policy in ('monthly', 'quarterly', 'semiannual', 'annual', 'none')),
  fee_base_usd numeric(14,2) not null,
  fee_base_ars numeric(14,2) not null,
  estimated_estured_fee_ars numeric(14,2) not null,
  acceptance_deadline_at timestamptz not null,
  sent_by_user_id uuid references public.users (id),
  accepted_at timestamptz,
  -- Fase 2 (pago/fee/comprobante) — columnas ya modeladas per docs/06
  -- §14.2 para no volver a migrar el schema, sin poblar todavía.
  external_residence_payment_id uuid references public.external_residence_payments (id),
  estured_fee_payment_id uuid references public.estured_fee_payments (id),
  renewal_receipt_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger renewal_offers_updated_at before update on public.renewal_offers
  for each row execute function public.set_updated_at();
create index renewal_offers_reservation_idx on public.renewal_offers (reservation_id);
create index renewal_offers_residence_idx on public.renewal_offers (residence_id);
create index renewal_offers_student_idx on public.renewal_offers (student_profile_id);
create index renewal_offers_request_idx on public.renewal_offers (renewal_request_id);

-- ==== renewal_receipts (docs/06 §14.3) — "Comprobante de Renovación Confirmada" ====
-- Reusa el enum public.receipt_status (migración 0011) — mismos
-- estados exactos que booking_receipts, sin necesidad de un enum
-- nuevo.
create table public.renewal_receipts (
  id uuid primary key default gen_random_uuid(),
  renewal_offer_id uuid not null references public.renewal_offers (id),
  status public.receipt_status not null default 'pending_generation',
  receipt_number text not null unique,
  verification_code text not null unique,
  qr_code_value text not null,
  pdf_file_id uuid references public.files (id),
  reissued_from_receipt_id uuid references public.renewal_receipts (id),
  voided_at timestamptz,
  receipt_payload jsonb not null default '{}'::jsonb,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger renewal_receipts_updated_at before update on public.renewal_receipts
  for each row execute function public.set_updated_at();
create index renewal_receipts_offer_idx on public.renewal_receipts (renewal_offer_id);
create index renewal_receipts_verification_code_idx on public.renewal_receipts (verification_code);

-- Ahora que renewal_offers y renewal_receipts existen, completar las
-- FKs pendientes que apuntaban hacia adelante:
alter table public.renewal_offers
  add constraint renewal_offers_renewal_receipt_fk
  foreign key (renewal_receipt_id) references public.renewal_receipts (id);

alter table public.estured_fee_payments
  add constraint estured_fee_payments_renewal_offer_fk
  foreign key (renewal_offer_id) references public.renewal_offers (id);

-- Trampa de FK bidireccional (MEMORY.md §10/§17/§18/§22) — octava
-- aparición: renewal_offers.estured_fee_payment_id ↔
-- estured_fee_payments.renewal_offer_id. Cualquier `select` con embed
-- implícito entre estas dos tablas va a necesitar el hint de FK
-- explícito desde el primer intento.

-- ==== Row Level Security (mismo patrón que application_requests, migración 0007) ====
alter table public.renewal_requests enable row level security;
create policy renewal_requests_select_student on public.renewal_requests
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );
create policy renewal_requests_select_family on public.renewal_requests
  for select to authenticated using (public.is_family_member_of_student(student_profile_id));
create policy renewal_requests_select_residence on public.renewal_requests
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

alter table public.renewal_offers enable row level security;
create policy renewal_offers_select_student on public.renewal_offers
  for select to authenticated using (
    student_profile_id in (
      select id from public.student_profiles where user_id = (select auth.uid())
    )
  );
create policy renewal_offers_select_family on public.renewal_offers
  for select to authenticated using (public.is_family_member_of_student(student_profile_id));
create policy renewal_offers_select_residence on public.renewal_offers
  for select to authenticated using (
    residence_id in (
      select residence_id from public.residence_users
      where user_id = (select auth.uid()) and is_active = true
    )
  );

-- renewal_receipts: mismo criterio que booking_receipts (migración
-- 0011) — sin policy para anon a propósito; la página pública
-- /verify lee con el service role.
alter table public.renewal_receipts enable row level security;
create policy renewal_receipts_select_student on public.renewal_receipts
  for select to authenticated using (
    renewal_offer_id in (
      select id from public.renewal_offers where student_profile_id in (
        select id from public.student_profiles where user_id = (select auth.uid())
      )
    )
  );

-- EstuRed — Migración 0011: fee EstuRed en modo manual + comprobante de reserva
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §4.9 y §13.3, docs/00 §14.3 y §15.1-15.3,
-- docs/03 §13.7, docs/07 §17.3-17.4, §18.2, §19.1, docs/08 §4.6, §6.8-6.9,
-- §8.10.
--
-- Alcance de esta migración (decisión del dueño 2026-07-09: sin
-- credenciales de MercadoPago/PayU/TusFacturas todavía): el código de
-- este ciclo solo cubre el camino MANUAL del fee (estudiante registra
-- referencia de pago → admin valida → reserva confirmada → comprobante
-- generado con verification_code + datos, sin PDF real ni Factura C
-- real todavía — fiscal_invoice_status queda en pending_issue,
-- pendiente de la integración real). payment_provider/estured_fee_status
-- ya soportan mercado_pago/payu_argentina desde la migración 0010 para
-- cuando existan las credenciales — no hace falta tocar el enum.

create type public.receipt_status as enum (
  'not_available', 'pending_generation', 'issued', 'generation_failed', 'voided', 'reissued'
);

-- Datos del pagador para la Factura C (docs/00 §15.3) — se recolectan
-- ahora aunque la emisión real (TusFacturas.app) sea la fase siguiente.
alter table public.estured_fee_payments
  add column payer_billing_name text,
  add column payer_billing_cuit text,
  add column payer_iva_condition text not null default 'consumidor_final'
    check (payer_iva_condition in ('consumidor_final', 'responsable_inscripto', 'monotributista', 'exento')),
  add column payment_channel text; -- docs/07 §17.3: canal informado del pago manual (transferencia, efectivo, etc.)

-- ==== booking_receipts (docs/06 §13.3) ====
create table public.booking_receipts (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  student_profile_id uuid not null references public.student_profiles (id),
  payer_user_id uuid not null references public.users (id),
  residence_id uuid not null references public.residences (id),
  status public.receipt_status not null default 'pending_generation',
  receipt_number text not null unique,
  verification_code text not null unique,
  qr_code_value text not null,
  pdf_file_id uuid references public.files (id),
  issued_at timestamptz,
  voided_at timestamptz,
  reissued_from_receipt_id uuid references public.booking_receipts (id),
  receipt_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger booking_receipts_updated_at before update on public.booking_receipts
  for each row execute function public.set_updated_at();
create index booking_receipts_reservation_idx on public.booking_receipts (reservation_id);
create index booking_receipts_verification_code_idx on public.booking_receipts (verification_code);

alter table public.reservations
  add constraint reservations_booking_receipt_fk
  foreign key (booking_receipt_id) references public.booking_receipts (id);

-- ==== Row Level Security ====

alter table public.booking_receipts enable row level security;
-- Dueño/familiar/residencia asociada: acceso completo (mismo patrón que reservations, migración 0010).
create policy booking_receipts_select_related on public.booking_receipts
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
-- Sin policy para `anon`: docs/08 §4.6 exige que /verify/[codigo] NUNCA muestre montos,
-- documentos ni datos de contacto — esta tabla (vía receipt_payload) sí los tiene. La
-- verificación pública lee con el service role (getSupabaseAdmin(), igual que el resto
-- del catálogo público) y el código de la ruta proyecta a mano solo los campos mínimos
-- permitidos, en vez de abrir la fila completa a anon por RLS.

comment on table public.booking_receipts is
  'Comprobante de Reserva Confirmada (docs/06 §13.3). verification_code es la clave pública de /verify/[codigo].';

-- EstuRed — Migración 0038: datos de cobro del fee en modo manual (D2 / H02)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción
--   (y recién entonces cargar los datos reales desde /admin/payment-settings).
--
-- MOTIVO. El paso del fee EstuRed no le decía al estudiante cómo pagar (auditoría 2026-10-20, H02).
-- Decisión D2 del dueño: en modo manual el estudiante paga por transferencia con los datos en pantalla
-- (docs/08 §6.8, docs/00 §14.3 y §31) y esos datos los carga el ADMIN — no se hardcodean.
--
-- DISEÑO.
--   - Una sola fila vigente: `singleton` es `true` con UNIQUE, así que no puede haber una segunda fila.
--     Editar = UPDATE de esa fila; el historial de cambios queda en `audit_logs`
--     (acción `payment_settings_updated`, con valor anterior y nuevo, CBU enmascarado).
--   - RLS habilitado SIN policies (mismo patrón que `waitlist_signups`): ni anon ni authenticated pueden
--     leer ni escribir. Solo el service role, desde server actions / server components que además
--     verifican que quien consulta es el estudiante dueño de la reserva o el familiar pagador.
--     NO agregar policies de SELECT/UPDATE para `authenticated`: expondría la cuenta de cobro a cualquiera.
--   - Solo un superadmin puede editarla (decisión del dueño): lo hace la server action `savePaymentSettings`
--     (la tabla no tiene policies, así que no hay otra vía de escritura); cada cambio avisa a todos los superadmin.
--   - Los CHECK espejan la validación server-side (`lib/payments/paymentSettingsValidation.ts`); el dígito
--     verificador del CBU se valida solo en la aplicación.

create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  account_holder text not null check (char_length(account_holder) between 2 and 120),
  alias text not null check (alias ~ '^[A-Za-z0-9.-]{6,20}$'),
  cbu text not null check (cbu ~ '^[0-9]{22}$'),
  bank_name text not null check (char_length(bank_name) between 2 and 80),
  holder_cuit text check (holder_cuit is null or holder_cuit ~ '^[0-9]{11}$'),
  instructions text check (instructions is null or char_length(instructions) <= 500),
  updated_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists payment_settings_updated on public.payment_settings;
create trigger payment_settings_updated_at before update on public.payment_settings
  for each row execute function public.set_updated_at();

alter table public.payment_settings enable row level security;

comment on table public.payment_settings is
  'Datos de cobro del fee EstuRed (transferencia manual). Una sola fila. Acceso solo via service role (RLS sin policies a propósito).';

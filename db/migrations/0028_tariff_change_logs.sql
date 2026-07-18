-- 0028 — Administración de tarifas: log de cambios de precio (Ciclo 34octovicies).
-- docs/09_ADMIN_PANEL_SPEC.md §9, docs/06_DATA_MODEL.md §8.6.
--
-- Registra cambios en tarifa mensual (por tipo de habitación), matrícula,
-- depósito y política de ajuste — se auditan pero NO requieren
-- aprobación previa (a diferencia de la revisión de ediciones de perfil
-- de la migración 0027: docs/09 §8.2 separa explícitamente "Precios" de
-- los campos críticos que sí gatean).
--
-- `old_value`/`new_value` son `text`, no `numeric` como sugiere el
-- modelo de datos documentado: uno de los 4 `field_name` posibles
-- (`adjustment_policy`) es un valor categórico ("quarterly", "annual",
-- etc.), no numérico — `text` cubre ambos casos sin duplicar columnas.

create table public.tariff_change_logs (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  room_type_id uuid references public.room_types (id) on delete cascade,
  changed_by uuid not null references public.users (id),
  field_name text not null check (field_name in ('monthly_price', 'enrollment_fee', 'deposit', 'adjustment_policy')),
  old_value text,
  new_value text,
  currency_code text,
  variation_percent numeric,
  alert_triggered boolean not null default false,
  admin_review_status text not null default 'new' check (admin_review_status in ('new', 'reviewed', 'ignored', 'flagged')),
  review_notes text,
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index tariff_change_logs_residence_idx on public.tariff_change_logs (residence_id, created_at desc);
create index tariff_change_logs_alerts_idx on public.tariff_change_logs (alert_triggered, admin_review_status, created_at desc);

-- Mismo patrón que el resto del proyecto: RLS habilitado sin policies,
-- solo el service role lee/escribe.
alter table public.tariff_change_logs enable row level security;

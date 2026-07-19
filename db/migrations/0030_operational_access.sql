-- 0030 — Mecanismo de acceso freemium a Gestión Operativa (Ciclo 34unodevicies-bis, Fase 9bis).
-- docs/12_BUILD_PLAN.md §15.3: "La asignación de acceso freemium es una
-- decisión operativa del equipo de EstuRed, no una decisión técnica —
-- Claude Code construye el mecanismo, no decide a quién otorgarlo."
--
-- Esta migración SOLO agrega el interruptor (quién lo tiene, desde
-- cuándo, hasta cuándo si es acceso de prueba para pioneras, motivo
-- auditado). No construye "Gestión Operativa" en sí (habitaciones/
-- plazas reales) — eso sigue sin existir en el código, decisión
-- aparte y más grande, diferida desde el Ciclo 32.

alter table public.residences
  add column if not exists has_operational_management_access boolean not null default false,
  add column if not exists operational_access_granted_by uuid references public.users (id),
  add column if not exists operational_access_granted_at timestamptz,
  add column if not exists operational_access_reason text,
  add column if not exists pioneer_free_access_until date;

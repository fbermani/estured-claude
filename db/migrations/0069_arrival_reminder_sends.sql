-- EstuRed — Migración 0069: registro de avisos de llegada enviados (DR29, Fase 2 del Centro de Guías, lote 2B)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    ADITIVA e IDEMPOTENTE (tabla con `if not exists`); no modifica filas existentes.
--    Necesita: `reservations` (0010) y `users`.
--    Hasta que se aplique, el job `notifyArrivalReminders` no envía nada (degrada sin romper los demás jobs del cron).
--
-- MOTIVO. docs/00 DR29: el cron horario manda avisos de llegada (estudiante a 14/7/2/0 días del ingreso; familiar activo a 7/2).
-- Esta tabla garantiza que cada aviso salga UNA sola vez por reserva + destinatario + aviso + canal.
--
-- QUÉ HACE
--   1. Tabla `arrival_reminder_sends` con UNIQUE (reservation_id, recipient_user_id, reminder_key, channel): el job inserta
--      la fila ANTES de enviar; si el insert choca con el unique, saltea (idempotencia ante corridas horarias o concurrentes).
--   2. RLS habilitada SIN policies a propósito: solo el service role (el cron) la lee y escribe. Nadie por JWT.
--
-- REVERTIR (el job vuelve a degradar sin enviar):
--   drop table if exists public.arrival_reminder_sends;

begin;

do $$
begin
  if to_regclass('public.reservations') is null then
    raise exception '0069: falta la tabla reservations (migración 0010)';
  end if;
end
$$;

create table if not exists public.arrival_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  reminder_key text not null check (reminder_key in ('t14', 't7', 't2', 't0')),
  channel text not null check (channel in ('in_app', 'email')),
  sent_at timestamptz not null default now(),
  unique (reservation_id, recipient_user_id, reminder_key, channel)
);
create index if not exists arrival_reminder_sends_reservation_idx on public.arrival_reminder_sends (reservation_id);

alter table public.arrival_reminder_sends enable row level security;
-- Sin policies a propósito: solo el service role accede.

commit;

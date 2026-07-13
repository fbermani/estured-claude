-- EstuRed — Migración 0021: notificaciones in-app
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Base mínima para avisar a un usuario cuando un admin toma una acción
-- que lo afecta directamente (docs/00 §29 define un NotificationProvider
-- completo con email/push — todavía no construido, ver GAPS.md). Esto
-- es deliberadamente más chico: solo in-app, sin canal externo.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  body text not null,
  related_entity_type text,
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, read_at, created_at desc);

-- ==== Row Level Security ====
-- Mismo patrón que audit_logs/waitlist_signups: las escrituras solo pasan
-- por server actions con el cliente admin (service role); acá solo se
-- habilita lectura de las propias notificaciones por si algún flujo futuro
-- necesita leer con el cliente de sesión.
alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

-- EstuRed — Migración 0101: notificaciones push web (DR61)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y prod por separado).
--
-- QUÉ HACE
--   1. `notifications.category` (none, requests_reservations, payments_fee, deadlines, admin_requests, admin_signups)
--      y `notifications.push_status` (none, queued, sending, sent, skipped, failed) + índice parcial sobre `queued`.
--   2. `push_subscriptions`: una fila por dispositivo (endpoint único). El usuario lee las suyas SIN `p256dh` ni `auth`.
--   3. `push_preferences`: interruptor por categoría (sin fila = activado).
--   Toda escritura va por server action con service role. Policies restrictivas `<tabla>_only_active_users` (patrón 0081).
--
-- REVERTIR: drop table if exists public.push_preferences, public.push_subscriptions;
--           drop index if exists public.notifications_push_queued_idx;
--           alter table public.notifications drop column if exists push_status, drop column if exists category;

begin;

do $$
begin
  if to_regclass('public.notifications') is null then
    raise exception '0101: falta notifications (migración 0021)';
  end if;
  if to_regprocedure('public.is_active_user()') is null then
    raise exception '0101: falta is_active_user() (migración 0081)';
  end if;
end
$$;

-- ==== 1. notifications ====
alter table public.notifications add column if not exists category text not null default 'none';
alter table public.notifications add column if not exists push_status text not null default 'none';

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications add constraint notifications_category_check
  check (category in ('none', 'requests_reservations', 'payments_fee', 'deadlines', 'admin_requests', 'admin_signups'));

alter table public.notifications drop constraint if exists notifications_push_status_check;
alter table public.notifications add constraint notifications_push_status_check
  check (push_status in ('none', 'queued', 'sending', 'sent', 'skipped', 'failed'));

create index if not exists notifications_push_queued_idx
  on public.notifications (created_at) where push_status = 'queued';

-- ==== 2. push_subscriptions ====
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint push_subscriptions_endpoint_https check (endpoint like 'https://%' and char_length(endpoint) <= 2048),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);
create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id) where revoked_at is null;

alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_subscriptions_only_active_users on public.push_subscriptions;
create policy push_subscriptions_only_active_users on public.push_subscriptions
  as restrictive for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, user_id, user_agent, created_at, last_seen_at, revoked_at) on public.push_subscriptions to authenticated;

-- ==== 3. push_preferences ====
create table if not exists public.push_preferences (
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category),
  constraint push_preferences_category_check
    check (category in ('requests_reservations', 'payments_fee', 'deadlines', 'admin_requests', 'admin_signups'))
);

alter table public.push_preferences enable row level security;
drop policy if exists push_preferences_select_own on public.push_preferences;
create policy push_preferences_select_own on public.push_preferences
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_preferences_only_active_users on public.push_preferences;
create policy push_preferences_only_active_users on public.push_preferences
  as restrictive for all to authenticated
  using ((select public.is_active_user())) with check ((select public.is_active_user()));

revoke all on public.push_preferences from anon, authenticated;
grant select on public.push_preferences to authenticated;

comment on table public.push_subscriptions is 'DR61: suscripciones Web Push por dispositivo. Escritura solo con service role; p256dh y auth no son legibles por el cliente.';
comment on table public.push_preferences is 'DR61: interruptor de push por categoría. Sin fila = activado. Escritura solo con service role.';

commit;

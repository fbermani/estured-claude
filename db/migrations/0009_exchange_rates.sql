-- EstuRed — Migración 0009: tipo de cambio real (ExchangeRateProvider)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: docs/06_DATA_MODEL.md §20.1, docs/11_TECH_ARCHITECTURE.md §14,
-- docs/00_DECISION_LOG.md §13, docs/09_ADMIN_PANEL_SPEC.md §25.
--
-- Reemplaza el tipo de cambio hardcodeado (lib/mock/exchange.ts, ver
-- GAPS.md "El tipo de cambio hardcodeado alimenta todos los precios
-- visibles") por una tabla real con caché diaria desde monedapi.ar
-- (dólar blue, valor venta). No incluye la UI de admin `/admin/exchange-rate`
-- (docs/09 §25.3: forzar actualización, quitar override, nota interna)
-- — queda como pendiente menor no bloqueante (ver MEMORY.md).

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  base_currency text not null default 'USD',
  quote_currency text not null default 'ARS',
  official_exchange_rate_ars_per_usd numeric(14, 6) not null,
  source_name text not null,
  source_url text,
  rate_type text not null default 'blue_sell',
  manually_overridden boolean not null default false,
  overridden_by_user_id uuid references public.users (id),
  override_reason text,
  fetched_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Docs/06 §20.1: "el override no pisa la fila automática... el unique de
-- rate_date pasa a ser parcial: único por fecha entre filas automáticas".
create unique index exchange_rates_auto_rate_date_idx
  on public.exchange_rates (rate_date) where manually_overridden = false;
create index exchange_rates_rate_date_idx on public.exchange_rates (rate_date desc, created_at desc);

alter table public.exchange_rates enable row level security;
-- Es un dato público (se muestra en cualquier ficha con precio en ARS);
-- las escrituras solo las hace el service role (lib/exchange/rate.ts),
-- no hay policy de insert/update para anon/authenticated a propósito.
create policy exchange_rates_select_public on public.exchange_rates
  for select to anon, authenticated using (true);

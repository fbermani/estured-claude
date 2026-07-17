-- 0026 — Notas internas del residente (Ciclo 34trevicies).
-- Pendiente explícito del Ciclo 34duovicies (MEMORY.md §13quatervicies):
-- sección "Notas Internas" del modal de referencia
-- `estured_admin_modal_perfil_del_residente` — visible SOLO para el
-- staff/dueño de la residencia, nunca para el residente ni público.

create table public.resident_notes (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  resident_stay_id uuid not null references public.resident_stays (id) on delete cascade,
  created_by_user_id uuid not null references public.users (id),
  -- Categorías de la referencia; "general" cubre convivencia/mantenimiento.
  category text not null default 'general' check (category in ('general', 'pagos')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index resident_notes_stay_idx on public.resident_notes (resident_stay_id, created_at desc);

-- Mismo patrón que rooms/beds: RLS habilitado sin policies — solo el
-- service role lee/escribe (son datos internos, nunca expuestos vía
-- PostgREST directo a un usuario autenticado).
alter table public.resident_notes enable row level security;

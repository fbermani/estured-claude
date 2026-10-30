-- EstuRed — Migración 0065: seguimiento admin de «Mi residencia no está» (DR21)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    IDEMPOTENTE; necesita 0064 (tabla missing_residence_requests). Hasta que se aplique, /admin/residencias-pedidas avisa que falta la migración.
--
-- QUÉ HACE
--   Agrega a `missing_residence_requests` el seguimiento manual del equipo de EstuRed: `contacted_at` y `contacted_by`
--   (el admin marca «Contactada» tras escribirle a la residencia a mano). Sin envío automático. La tabla sigue con RLS sin
--   policies y sin grants para anon/authenticated: solo service role.
--
-- REVERTIR:
--   alter table public.missing_residence_requests drop column if exists contacted_at, drop column if exists contacted_by;
--   drop index if exists public.missing_residence_requests_pending_idx;

begin;

do $$
begin
  if to_regclass('public.missing_residence_requests') is null then
    raise exception '0065: falta missing_residence_requests (migración 0064)';
  end if;
end
$$;

alter table public.missing_residence_requests add column if not exists contacted_at timestamptz;
alter table public.missing_residence_requests add column if not exists contacted_by uuid references public.users (id) on delete set null;
create index if not exists missing_residence_requests_pending_idx on public.missing_residence_requests (created_at desc) where contacted_at is null;

revoke all on public.missing_residence_requests from anon, authenticated;

commit;

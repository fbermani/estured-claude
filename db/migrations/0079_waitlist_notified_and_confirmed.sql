-- EstuRed — Migración 0079: fecha del aviso y «Decidió esperar» en la lista de espera (DR41)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: NO está aplicada. Es ADITIVA e IDEMPOTENTE (add column if not exists).
--    Hasta que se aplique, las pantallas degradan con gracia: se ven igual, sin la fecha del aviso ni la marca «Decidió esperar».
--
-- QUÉ HACE
--   Agrega a `waitlist_entries`:
--     · notified_at          timestamptz null — cuándo la residencia avisó «hay lugar» (se actualiza en cada aviso).
--     · waiting_confirmed_at timestamptz null — cuándo el estudiante eligió «Seguir esperando»; se limpia si lo reavisan.
--   Sin cambios de RLS (las policies de la tabla no dependen de estas columnas).
--
-- CÓMO REVERTIR
--   alter table public.waitlist_entries drop column if exists notified_at;
--   alter table public.waitlist_entries drop column if exists waiting_confirmed_at;

alter table public.waitlist_entries add column if not exists notified_at timestamptz;
alter table public.waitlist_entries add column if not exists waiting_confirmed_at timestamptz;

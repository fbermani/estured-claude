-- EstuRed — Migración 0084: topes de longitud y de precio (auditoría de seguridad 2026-11-11: B4)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción. NO está aplicada.
--    Es IDEMPOTENTE (drop constraint if exists + add not valid + validate) y no modifica datos; si alguna fila existente viola un
--    tope, el `validate constraint` falla y ese CHECK queda `not valid` (rige solo para filas nuevas): revisar esas filas y reintentar.
--
-- QUÉ HACE
--   Topes server-side espejados en la base (las server actions ya validan; esto cubre el acceso directo y futuros caminos):
--   residences.description <= 5000, student_profiles.bio <= 5000, support_cases.description <= 5000 (se suma al mínimo de 20 de 0023),
--   files.filename <= 255, room_types.monthly_price_usd <= 100000.

begin;

alter table public.residences drop constraint if exists residences_description_max_len;
alter table public.residences add constraint residences_description_max_len check (description is null or char_length(description) <= 5000) not valid;
alter table public.residences validate constraint residences_description_max_len;

alter table public.student_profiles drop constraint if exists student_profiles_bio_max_len;
alter table public.student_profiles add constraint student_profiles_bio_max_len check (bio is null or char_length(bio) <= 5000) not valid;
alter table public.student_profiles validate constraint student_profiles_bio_max_len;

alter table public.support_cases drop constraint if exists support_cases_description_max_len;
alter table public.support_cases add constraint support_cases_description_max_len check (char_length(description) <= 5000) not valid;
alter table public.support_cases validate constraint support_cases_description_max_len;

alter table public.files drop constraint if exists files_filename_max_len;
alter table public.files add constraint files_filename_max_len check (char_length(filename) <= 255) not valid;
alter table public.files validate constraint files_filename_max_len;

alter table public.room_types drop constraint if exists room_types_price_max;
alter table public.room_types add constraint room_types_price_max check (monthly_price_usd <= 100000) not valid;
alter table public.room_types validate constraint room_types_price_max;

commit;

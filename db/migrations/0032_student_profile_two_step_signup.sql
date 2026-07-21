-- Ciclo 35 (cont.) — alta de estudiante en 2 pasos (docs/08 §5.3 ampliado
-- por decisión del dueño): el registro solo pide nombre, apellido, fecha
-- de nacimiento, teléfono, email y contraseña. Nacionalidad e institución
-- de estudio pasan a completarse después en /students/profile, así que
-- dejan de poder exigirse en el insert inicial.
--
-- `profile_completed_at` ya existía sin usar desde la migración 0002 —
-- este cambio es la primera vez que el campo se vuelve necesario de
-- verdad (antes todo se pedía de una, así que el perfil siempre nacía
-- completo).

alter table public.student_profiles
  alter column nationality drop not null;

alter table public.student_profiles
  alter column study_institution_private drop not null;

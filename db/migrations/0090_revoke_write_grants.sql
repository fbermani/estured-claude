-- 0090 — Quitar permisos de escritura de `anon` y `authenticated` sobre las tablas de `public` (SEG15-04, 2026-11-15).
--
-- Supabase da por defecto INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER a anon y authenticated sobre toda tabla nueva. Hoy ninguna
-- policy PERMISSIVE habilita escrituras (todas las mutaciones van por server actions con service role), así que RLS ya las frenaba;
-- esto elimina la dependencia de «no hay policy»: un `create policy` mal puesto en el futuro ya no abre escritura directa.
--
-- Mantiene SELECT (lo gobiernan RLS y los grants por columna de 0081) y no toca `service_role`. Revocar a nivel tabla también quita
-- los grants por columna de escritura (0055). Idempotente. No toca datos.
-- El cliente de la app no escribe con el JWT del usuario (verificado: solo `getSupabaseAdmin()` muta).

revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;

-- Tablas futuras: que no nazcan con escritura para anon/authenticated (lo que cree el rol que corre las migraciones).
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

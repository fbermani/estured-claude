-- EstuRed — Migración 0083: rate limit persistente en Postgres (auditoría de seguridad 2026-11-11: M6)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Es IDEMPOTENTE (create ... if not exists / create or replace / revoke+grant se pueden correr dos veces) y no toca datos
--    existentes. No depende de otras tablas (solo de `public`).
--    Mientras no esté aplicada, `lib/security/rateLimit.ts` deja pasar en desarrollo/tests (fail-open + console.error) y en
--    producción corta (fail-closed): aplicarla en producción ANTES de deployar el código que la usa.
--
-- Fuente: docs/audits/SEGURIDAD_2026-11-11.md (M6). Reemplaza los frenos en memoria por instancia (inefectivos en serverless) de
--   login, registro, preapertura y recuperación de contraseña, sin sumar infraestructura externa (decisión del dueño 2026-11-12).
--
-- QUÉ HACE
--   1. `public.rate_limit_hits`: un registro por intento permitido (bucket + hash SHA-256 de la clave; nunca IP ni email en claro).
--      RLS habilitada SIN policies a propósito (igual que `waitlist_signups`): solo el service role la lee/escribe.
--   2. `public.consume_rate_limit(bucket, key_hash, window_seconds, max)` → boolean. Atómica por clave
--      (`pg_advisory_xact_lock`): borra los hits vencidos de esa clave, cuenta los vigentes y, si hay lugar, registra el intento y
--      devuelve true; si no, devuelve false SIN registrar (así una clave nunca guarda más de `max` filas aunque la martillen).
--      Además, ~1 de cada 100 llamadas barre filas de más de 2 días de cualquier clave (claves que no vuelven).
--      Solo la ejecuta `service_role`.

begin;

-- ===== 1. Tabla =====
create table if not exists public.rate_limit_hits (
  id bigserial primary key,
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_key_created_idx
  on public.rate_limit_hits (bucket, key_hash, created_at desc);

-- Para el barrido global de filas viejas.
create index if not exists rate_limit_hits_created_idx
  on public.rate_limit_hits (created_at);

alter table public.rate_limit_hits enable row level security;
-- Sin policies a propósito: ni anon ni authenticated acceden (ni por PostgREST ni por grants).
revoke all on table public.rate_limit_hits from public, anon, authenticated;
revoke all on sequence public.rate_limit_hits_id_seq from public, anon, authenticated;

-- ===== 2. Función =====
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_window_seconds int,
  p_max int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_count int;
begin
  if p_bucket is null or p_key_hash is null or length(p_bucket) = 0 or length(p_bucket) > 64
     or length(p_key_hash) = 0 or length(p_key_hash) > 128
     or p_window_seconds is null or p_window_seconds <= 0 or p_window_seconds > 604800
     or p_max is null or p_max <= 0 or p_max > 10000 then
    raise exception 'consume_rate_limit: parámetros inválidos' using errcode = '22023';
  end if;

  -- Serializa las llamadas concurrentes de la misma clave (se libera al terminar la transacción).
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_key_hash));

  v_since := now() - make_interval(secs => p_window_seconds);

  delete from public.rate_limit_hits
   where bucket = p_bucket and key_hash = p_key_hash and created_at < v_since;

  select count(*) into v_count
    from public.rate_limit_hits
   where bucket = p_bucket and key_hash = p_key_hash;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, key_hash) values (p_bucket, p_key_hash);

  -- Barrido oportunista de claves abandonadas (la ventana más larga en uso es de 1 día).
  if random() < 0.01 then
    delete from public.rate_limit_hits where created_at < now() - interval '2 days';
  end if;

  return true;
end;
$$;

revoke execute on function public.consume_rate_limit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, int, int) to service_role;

commit;

-- ===== Verificación (opcional, correr aparte) =====
-- select public.consume_rate_limit('prueba', 'abc', 60, 2);  -- true
-- select public.consume_rate_limit('prueba', 'abc', 60, 2);  -- true
-- select public.consume_rate_limit('prueba', 'abc', 60, 2);  -- false
-- delete from public.rate_limit_hits where bucket = 'prueba';

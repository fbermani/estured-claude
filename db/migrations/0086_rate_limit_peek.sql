-- EstuRed — Migración 0086: consulta de solo lectura del rate limit (ajuste del login: contar solo intentos fallidos)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run (dev y producción, por separado).
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: depende de la 0083 (tabla `rate_limit_hits`). NO está aplicada. Es idempotente.
--
-- `public.peek_rate_limit(bucket, key_hash, window_seconds, max)` → true si todavía hay lugar (hits vigentes < max).
-- No inserta ni borra nada. Solo la ejecuta `service_role`. Mismas validaciones de parámetros que `consume_rate_limit`.

begin;

create or replace function public.peek_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_window_seconds int,
  p_max int
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_bucket is null or p_key_hash is null or length(p_bucket) = 0 or length(p_bucket) > 64
     or length(p_key_hash) = 0 or length(p_key_hash) > 128
     or p_window_seconds is null or p_window_seconds <= 0 or p_window_seconds > 604800
     or p_max is null or p_max <= 0 or p_max > 10000 then
    raise exception 'peek_rate_limit: parámetros inválidos' using errcode = '22023';
  end if;

  select count(*) into v_count
    from public.rate_limit_hits
   where bucket = p_bucket
     and key_hash = p_key_hash
     and created_at >= now() - make_interval(secs => p_window_seconds);

  return v_count < p_max;
end;
$$;

revoke execute on function public.peek_rate_limit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.peek_rate_limit(text, text, int, int) to service_role;

commit;

-- Verificación (opcional): select public.peek_rate_limit('prueba', 'abc', 60, 2);  -- true si hay menos de 2 hits

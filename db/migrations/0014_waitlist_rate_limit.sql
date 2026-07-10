-- EstuRed — Migración 0014: rate limiting de la waitlist pública
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
--
-- Fuente: GAPS.md "Sin rate limiting ni protección real anti-spam en la
-- waitlist" (severidad Media) — el único filtro hoy es un honeypot, que
-- un script trivial puede omitir. El índice único en `lower(email)` ya
-- previene duplicados exactos, pero no spam masivo con emails únicos
-- falsos generados desde el mismo origen.
--
-- Enfoque (el más simple de los dos sugeridos en GAPS.md): agregar
-- `ip_hash` a la propia tabla y contar inserts recientes por hash antes
-- de aceptar uno nuevo — no hace falta una tabla separada para el
-- volumen de tráfico pre-lanzamiento. Se guarda el HASH de la IP, no la
-- IP en texto plano (la IP es dato personal, docs/10 — no hace falta
-- guardarla reversible para este propósito).

alter table public.waitlist_signups
  add column if not exists ip_hash text;

create index if not exists waitlist_signups_ip_hash_idx
  on public.waitlist_signups (ip_hash, created_at);

comment on column public.waitlist_signups.ip_hash is
  'SHA-256 de la IP del request (no la IP en texto plano) — solo para contar inserts recientes por origen y frenar spam masivo.';

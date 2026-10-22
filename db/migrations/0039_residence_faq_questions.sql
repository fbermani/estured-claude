-- EstuRed — Migración 0039: FAQ simple, pregunta libre del visitante (H12 / decisión D9)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción.
--
-- MOTIVO. Decisión D9 (docs/00 §20.2 y §31, docs/02 §7.22, docs/08 §7.16): además de las preguntas
-- frecuentes que carga la residencia (hasta 5 pares, sección `faq` de `residence_profile_sections`), el
-- visitante puede hacer UNA pregunta libre desde la ficha y la residencia la responde desde su panel.
-- NO es un bot ni responde automático. Las preguntas sin responder quedan registradas.
--
-- DISEÑO.
--   - Todo se escribe y se lee por service role desde server actions (el cliente nunca escribe estados):
--     RLS habilitado SIN ninguna policy, mismo criterio que `waitlist_signups`. Las preguntas `answered`
--     se entregan al visitante leyendo en el servidor y devolviendo solo pregunta + respuesta.
--   - Sin PII obligatoria: `asked_by_user_id` solo si el visitante tenía sesión (sirve para avisarle en la
--     app cuando le responden) e `ip_hash` (SHA-256, nunca la IP) solo para el límite de envíos por hora.
--     No se pide ni se guarda email.
--   - Estados (supuesto reversible, no figuran en docs/04): `pending` (recién llegada, sin responder),
--     `answered` (la residencia la respondió; es la única visible en la ficha) y `hidden` (moderación:
--     la residencia la oculta; se puede restaurar).
--   - `on delete cascade` desde `residences`: no requiere tocar `deleteResidenceCascade` ni los seeds.
--
-- ROLLBACK:
--   drop table public.residence_faq_questions;
--   drop type public.residence_faq_question_status;

begin;

create type public.residence_faq_question_status as enum ('pending', 'answered', 'hidden');

create table public.residence_faq_questions (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 10 and 500),
  -- Solo si quien preguntó tenía sesión. Se anula si el usuario se borra (la pregunta queda).
  asked_by_user_id uuid references public.users (id) on delete set null,
  -- SHA-256 de la IP (nunca la IP en texto plano): único uso, el límite de envíos por hora.
  ip_hash text,
  status public.residence_faq_question_status not null default 'pending',
  answer text check (answer is null or char_length(btrim(answer)) between 1 and 1500),
  answered_by_user_id uuid references public.users (id) on delete set null,
  answered_at timestamptz,
  hidden_by_user_id uuid references public.users (id) on delete set null,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una pregunta `answered` siempre tiene respuesta y fecha.
  constraint residence_faq_questions_answered_check
    check (status <> 'answered' or (answer is not null and answered_at is not null))
);

create trigger residence_faq_questions_updated_at before update on public.residence_faq_questions
  for each row execute function public.set_updated_at();

create index residence_faq_questions_residence_idx
  on public.residence_faq_questions (residence_id, status, created_at desc);
create index residence_faq_questions_ip_idx
  on public.residence_faq_questions (ip_hash, created_at) where ip_hash is not null;
create index residence_faq_questions_user_idx
  on public.residence_faq_questions (asked_by_user_id, created_at) where asked_by_user_id is not null;

alter table public.residence_faq_questions enable row level security;
-- Sin policies a propósito: solo el service role (server actions) lee y escribe.

comment on table public.residence_faq_questions is
  'Pregunta libre del visitante a una residencia (D9). La responde una persona de la residencia; no hay respuesta automática. RLS sin policies: solo service role.';

commit;

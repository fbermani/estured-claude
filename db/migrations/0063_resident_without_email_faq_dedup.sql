-- EstuRed — Migración 0063: residente sin mail (nombre + teléfono) y FAQ-29/FAQ-50 unificadas (DR18, fase 2, tanda 4)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    IDEMPOTENTE; necesita la 0019 (resident_stays). Sin tablas, policies ni funciones nuevas: no cambia RLS ni grants
--    (las columnas nuevas quedan bajo las policies de fila existentes de `resident_stays`: las ve la residencia, el propio residente y su familia vinculada).
--
-- QUÉ HACE
--   1. `resident_stays.invite_name` y `resident_stays.invite_phone` (PII mínima, texto corto): permiten cargar un residente SIN mail, con
--      nombre y teléfono opcional (punto 20 de la auditoría del Owner). Queda «sin activar» hasta que la residencia le cargue un mail
--      y la persona active su cuenta con ese mail (flujo de `activateResidentStay`, sin cambios).
--   2. CHECK `resident_stays_has_identifier`: toda estadía sin cuenta vinculada necesita mail o nombre (NOT VALID: no revisa filas viejas).
--   3. Índice único parcial: no puede haber dos estadías vigentes sin mail y sin cuenta con el mismo nombre en la misma residencia.
--   4. FAQ: una sola pregunta de «¿Con quién voy a compartir…?». Queda FAQ-29 (editable por la residencia) con el contenido útil de las dos;
--      FAQ-50 se desactiva. Si una residencia tenía una respuesta propia (answer_override) en FAQ-50 se copia a FAQ-29 y queda elegida;
--      si no, FAQ-29 NO se elige sola (traería {campos} sin completar): la residencia la completa y la activa desde su FAQ.
--
-- SEGURIDAD de invite_name / invite_phone (PII): la app los lee SOLO con service role (`app/residence/[residence_id]/residents/page.tsx`).
--   No se hace `revoke select (columna)` porque `authenticated` tiene el grant a nivel tabla (un revoke por columna no tendría efecto sin
--   rehacer todos los grants). Con JWT solo se alcanzan por las policies de fila existentes: la residencia (equipo activo) y el estudiante/familia
--   dueños de la estadía; estas filas sin mail no tienen `student_profile_id`, así que no las ve ningún estudiante. anon no tiene acceso
--   (resident_stays no tiene policy para anon; además figuran en scripts/sensitive-columns.json).
--
-- REVERTIR: drop index resident_stays_current_nameless_unique; alter table resident_stays drop constraint resident_stays_has_identifier,
--   drop column invite_name, drop column invite_phone; update residence_faq_predefined_questions set is_active = true where id = 'FAQ-50'.

begin;

do $$
begin
  if to_regclass('public.resident_stays') is null then
    raise exception '0063: falta la tabla resident_stays (migración 0019)';
  end if;
end
$$;

-- ==== 1. Residente sin mail ====
alter table public.resident_stays add column if not exists invite_name text;
alter table public.resident_stays add column if not exists invite_phone text;

alter table public.resident_stays drop constraint if exists resident_stays_invite_name_len;
alter table public.resident_stays add constraint resident_stays_invite_name_len
  check (invite_name is null or char_length(btrim(invite_name)) between 2 and 80);
alter table public.resident_stays drop constraint if exists resident_stays_invite_phone_fmt;
alter table public.resident_stays add constraint resident_stays_invite_phone_fmt
  check (invite_phone is null or invite_phone ~ '^[0-9]{8,15}$');

alter table public.resident_stays drop constraint if exists resident_stays_has_identifier;
alter table public.resident_stays add constraint resident_stays_has_identifier
  check (student_profile_id is not null or invite_email is not null or invite_name is not null) not valid;

create unique index if not exists resident_stays_current_nameless_unique
  on public.resident_stays (residence_id, lower(btrim(invite_name)))
  where is_current = true and invite_email is null and student_profile_id is null and invite_name is not null;

comment on column public.resident_stays.invite_name is
  'DR18 t4: nombre de un residente cargado sin mail (solo visible para la residencia). Se vincula después cargando el mail.';
comment on column public.resident_stays.invite_phone is
  'DR18 t4: teléfono opcional (solo dígitos con código de país) para compartir el mensaje de registro por WhatsApp MANUAL. Nunca se usa la API de WhatsApp.';

-- ==== 2. FAQ-29 / FAQ-50 ====
do $$
begin
  if to_regclass('public.residence_faq_predefined_questions') is not null then
    update public.residence_faq_predefined_questions
    set suggested_answer = $a$Lo que ves hoy en la ficha —quiénes viven en la residencia— no es necesariamente con quienes te va a tocar compartir. En {tipos_compartidos} compartís con {cantidad_companeros}. La residencia {criterio_de_asignacion}. Podés pedir {pedidos_posibles}, sujeto a lo que la residencia pueda confirmar. La asignación de la plaza depende de múltiples factores, como el tipo de habitación y las decisiones de la residencia al momento de tu ingreso. Por eso la solicitud queda sujeta a confirmación.$a$
    where id = 'FAQ-29';

    -- Solo se migra una respuesta propia de FAQ-50 (si existe); sin ella FAQ-29 no se elige sola (traería {campos} sin completar).
    if to_regclass('public.residence_faq_items') is not null then
      insert into public.residence_faq_items (residence_id, predefined_question_id, is_selected, answer_override)
      select residence_id, 'FAQ-29', true, answer_override
      from public.residence_faq_items
      where predefined_question_id = 'FAQ-50' and is_selected and answer_override is not null
      on conflict (residence_id, predefined_question_id) do nothing;

      update public.residence_faq_items set is_selected = false
      where predefined_question_id = 'FAQ-50' and is_selected;
    end if;

    update public.residence_faq_predefined_questions set is_active = false where id = 'FAQ-50';
  end if;
end
$$;

commit;

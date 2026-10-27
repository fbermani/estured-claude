-- EstuRed — Migración 0056: ajustes del catálogo de FAQ por la auditoría del Owner (DR18, fase 1)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Necesita la 0054 aplicada (tabla residence_faq_predefined_questions). Es IDEMPOTENTE y NO borra datos: las preguntas
--    quitadas solo se desactivan (is_active = false) y las selecciones/respuestas que las residencias ya tenían quedan guardadas.
--    No toca RLS ni grants (las policies de 0054 ya filtran por is_active). Sin SECURITY DEFINER.
--    Hasta que se aplique, el código no se rompe: el catálogo sigue mostrando las preguntas de la 0054.
--
-- QUÉ HACE
--   1. Desactiva «¿Puedo hacer una visita, presencial o virtual?» (FAQ-01) y «¿Cómo funciona la comida?» (FAQ-38).
--      Desaparecen de la pantalla de la residencia y de la ficha pública; los datos se conservan.
--   2. FAQ-35 («Mi familia viene de visita…») deja de remitir a la pregunta desactivada (FAQ-01).
--   3. Agrega (texto fijo de EstuRed, sin campos editables):
--        FAQ-50 «¿Con quién voy a compartir?»  (convivencia_y_reglas)
--        FAQ-51 «¿Qué es el mes vacío y por qué se cobra?» (costos_y_pagos) — sin números concretos; aclara que solo se cobra si la
--               plaza queda realmente vacía, nunca por toda reserva con ingreso diferido.
--      Alta con `on conflict do update` sobre texto, tema, orden y owner; NO toca is_active si el admin la desactivó.
--
-- REVERTIR:
--   update public.residence_faq_predefined_questions set is_active = true where id in ('FAQ-01', 'FAQ-38');
--   update public.residence_faq_predefined_questions set is_active = false where id in ('FAQ-50', 'FAQ-51');

begin;

do $$
begin
  if to_regclass('public.residence_faq_predefined_questions') is null then
    raise exception '0056: falta la tabla residence_faq_predefined_questions (migración 0054)';
  end if;
end
$$;

-- 1. Preguntas que salen del catálogo (se desactivan, no se borran).
update public.residence_faq_predefined_questions
   set is_active = false
 where id in ('FAQ-01', 'FAQ-38');

-- 2. FAQ-35 no remite más a la pregunta de visitas desactivada.
update public.residence_faq_predefined_questions
   set suggested_answer = $a${familia_visita_politica}: pueden conocerla en {horario_visitas}, avisando a {contacto_visitas}.$a$
 where id = 'FAQ-35';

-- 3. Preguntas nuevas (texto fijo de EstuRed).
insert into public.residence_faq_predefined_questions (id, category, question_text, suggested_answer, owner, display_order) values
  ('FAQ-50', 'convivencia_y_reglas', $q$¿Con quién voy a compartir?$q$,
   $a$Lo que ves hoy en la ficha —quiénes viven en la residencia— no es necesariamente con quienes te va a tocar compartir. La asignación de la plaza depende de múltiples factores, como el tipo de habitación y las decisiones de la residencia al momento de tu ingreso. Por eso la solicitud queda sujeta a confirmación.$a$,
   'estured', 295),
  ('FAQ-51', 'costos_y_pagos', $q$¿Qué es el mes vacío y por qué se cobra?$q$,
   $a$Algunas residencias permiten reservar hoy para ingresar más adelante. En ese caso puede aplicarse un «mes vacío»: la residencia mantiene la plaza sin que la ocupes y por eso cobra una parte de la mensualidad. Solo se cobra si la plaza queda realmente vacía durante ese período: no se cobra en toda reserva con ingreso diferido. El porcentaje y las condiciones los define cada residencia y los ves en su ficha antes de enviar la solicitud. Se paga a la residencia, no a EstuRed.$a$,
   'estured', 225)
on conflict (id) do update set
  category = excluded.category,
  question_text = excluded.question_text,
  suggested_answer = excluded.suggested_answer,
  owner = excluded.owner,
  display_order = excluded.display_order;

commit;

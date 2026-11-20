-- EstuRed — Migración 0099: poda del catálogo de FAQ (decisión del dueño 2026-11-19)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- Aplicada en estured-dev el 2026-11-19. Producción: pendiente (se arma con el bootstrap).
--    Necesita la 0054 aplicada. Es IDEMPOTENTE y NO borra datos: las preguntas solo se desactivan (is_active = false) y las
--    selecciones/respuestas que las residencias ya tenían quedan guardadas. No toca RLS ni grants (las policies de 0054 filtran
--    por is_active). Sin SECURITY DEFINER.
--
-- QUÉ HACE: desactiva 15 preguntas que (a) repiten datos que la ficha ya muestra de forma estructurada, (b) explican el proceso de
-- EstuRed y conviene tenerlas en un solo lugar (guías / FAQ de /for-students) o (c) aportan poco en la ficha.
--   (a) FAQ-05 tipos de habitación, FAQ-12 matrícula, FAQ-19 depósito, FAQ-21 ajustes de precio, FAQ-22 reserva con mes vacío,
--       FAQ-40 estadía mínima.
--   (b) FAQ-02 qué pasa al enviar la solicitud, FAQ-03 hay lugar disponible, FAQ-17 fee EstuRed, FAQ-24 puede pagar mi familia,
--       FAQ-44 a quién recurro, FAQ-46 qué datos ve la residencia, FAQ-47 qué ve mi familia.
--   (c) FAQ-23 moneda, FAQ-31 qué pasa si no se cumplen las reglas.
-- No toca las «Esenciales» (FAQ-07, 09, 36, 42, 43, 49).
--
-- REVERTIR:
--   update public.residence_faq_predefined_questions set is_active = true
--    where id in ('FAQ-02','FAQ-03','FAQ-05','FAQ-12','FAQ-17','FAQ-19','FAQ-21','FAQ-22','FAQ-23','FAQ-24','FAQ-31','FAQ-40','FAQ-44','FAQ-46','FAQ-47');

begin;

do $$
begin
  if to_regclass('public.residence_faq_predefined_questions') is null then
    raise exception '0099: falta la tabla residence_faq_predefined_questions (migración 0054)';
  end if;
end
$$;

update public.residence_faq_predefined_questions
   set is_active = false
 where id in ('FAQ-02','FAQ-03','FAQ-05','FAQ-12','FAQ-17','FAQ-19','FAQ-21','FAQ-22','FAQ-23','FAQ-24','FAQ-31','FAQ-40','FAQ-44','FAQ-46','FAQ-47');

commit;

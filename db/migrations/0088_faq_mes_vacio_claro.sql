-- EstuRed — Migración 0088: FAQ-51 (y FAQ-22) del mes vacío con una explicación clara (DR53)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ Aplicarla en estured-dev y, por separado, en producción. IDEMPOTENTE. Solo actualiza el texto sugerido del catálogo
--    (`suggested_answer`): NO toca `residence_faq_items.answer_override`, así que las respuestas que ya editó una residencia quedan como están.
--
-- QUÉ HACE
--   - FAQ-51 (texto fijo de EstuRed): idea central primero, sin «descuento», con ejemplo y reglas de DR18 t3 (segunda corrección).
--   - FAQ-22 (la residencia completa los campos): «por cada mes hasta el ingreso» confundía; ahora habla del tiempo en que la plaza queda libre.
-- REVERTIR: volver a pegar el texto de las migraciones 0062 (FAQ-51) y 0054 (FAQ-22).

begin;

do $$
begin
  if to_regclass('public.residence_faq_predefined_questions') is not null then
    update public.residence_faq_predefined_questions
    set suggested_answer = $a$Si reservás para ingresar más adelante y la plaza está libre mientras tanto, la residencia te la guarda. Por ese tiempo sin vos adentro, que llamamos «mes vacío», cobra un porcentaje de la renta mensual (lo define cada residencia), no la renta entera. No es un descuento: es un cargo parcial por tener la plaza vacía esperándote. Solo aplica si ingresás después del primer día en que la plaza está disponible y la residencia publicó esa disponibilidad. Se cuenta desde que está libre hasta el día anterior a tu ingreso: cada mes completo suma uno y, si sobran días, más de 15 cuentan como un mes y de 1 a 15 como medio mes, hasta 3 meses. Ejemplo: la plaza está disponible hoy, ingresás en 45 días y la residencia cobra 50 %: son 1,5 meses × 50 % = 0,75 de una renta mensual. Si ingresás el primer día disponible, o la plaza está ocupada en ese tramo, no se cobra. Si la residencia todavía no confirmó la disponibilidad, lo ves como «a confirmar por la residencia» antes de enviar la solicitud y no se suma hasta entonces. Se paga a la residencia, no a EstuRed.$a$
    where id = 'FAQ-51';

    update public.residence_faq_predefined_questions
    set suggested_answer = $a${admite_ingreso_diferido: Sí / No}. {si_admite: Cobra {porcentaje_mes_vacio} de la mensualidad por el tiempo en que la plaza queda libre esperándote antes de tu ingreso (el «mes vacío»), hasta {maximo_meses_mes_vacio} meses}. {condicion_cancelacion_diferido}.$a$
    where id = 'FAQ-22';
  end if;
end
$$;

commit;

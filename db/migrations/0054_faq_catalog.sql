-- EstuRed — Migración 0054: catálogo único de preguntas frecuentes (FAQ) con selección y respuesta editable por residencia (DR14, fase 2b)
-- Aplicar en: Supabase Dashboard → SQL Editor → New query → pegar y Run.
-- ⚠ REQUIERE ACCIÓN DEL DUEÑO: aplicarla primero en estured-dev y después en producción (por separado). NO está aplicada.
--    Es ADITIVA e IDEMPOTENTE (create ... if not exists, drop/create de policies y triggers, insert ... on conflict do update) y no toca
--    ninguna fila existente: la FAQ libre del visitante (`residence_faq_questions`, 0039, D9) y las 5 preguntas fijas de la ficha
--    (`residence_profile_sections.faq`) siguen igual. Se puede re-correr: re-carga el catálogo con el texto de esta migración y NO pisa
--    las selecciones ni las respuestas editadas de las residencias.
--    Necesita: `residences` (0003) y la función `set_updated_at` (0002/0039).
--    Hasta que se aplique, el código degrada con gracia: la pantalla de la residencia avisa que el catálogo todavía no está disponible y la
--    ficha pública sigue mostrando solo las preguntas fijas y las libres respondidas.
--
-- MOTIVO. docs/00 §31 DR14 (2), docs/06 §17.1–17.2, docs/08 §7.16: catálogo ÚNICO de preguntas; cada residencia elige cuáles mostrar y
-- edita la respuesta sugerida. Reemplaza «catálogo fuera de alcance» de D9; se suma a la FAQ libre, que no cambia.
--
-- QUÉ HACE
--   1. `residence_faq_predefined_questions` (docs/06 §17.1): id estable `FAQ-NN` (text), `category` (tema), `question_text`, `suggested_answer`
--      (puede traer campos `{…}` que la residencia completa), `owner` (`estured` = texto fijo de plataforma, la residencia no lo edita;
--      `residence` = la residencia completa los campos; ninguna parte fija de EstuRed es editable), `display_order`, `is_active`.
--   2. `residence_faq_items` (docs/06 §17.2): una fila por (residencia, pregunta del catálogo): `is_selected` (interruptor «Mostrar») y
--      `answer_override` (texto final editado; null = se muestra la sugerida, solo válido para las `estured` o las sin campos `{…}`).
--      La validación de que no queden campos `{…}` sin completar es server-side (lib/faq/catalog.ts); acá un CHECK de red de seguridad
--      impide guardar un override vacío.
--   3. RLS. Catálogo: lectura pública SOLO de las preguntas activas. Selección: lectura pública SOLO de las filas seleccionadas de
--      residencias `verified_active`. Escritura: solo service role (server actions). El equipo de la residencia lee y escribe por el servidor.
--   4. Carga del catálogo: las 49 FAQs de docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md Parte B (sin datos privados ni nombres de residencias),
--      con `insert ... on conflict (id) do update` (se actualiza texto, tema, orden y owner; NO se toca `is_active` si el admin la desactivó).
--
-- REVERTIR (borra el catálogo y las selecciones; el código vuelve a degradar con gracia):
--   drop table if exists public.residence_faq_items;
--   drop table if exists public.residence_faq_predefined_questions;

begin;

-- ==== 0. Guarda ====
do $$
begin
  if to_regclass('public.residences') is null then
    raise exception '0054: falta la tabla residences (migración 0003)';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception '0054: falta la función set_updated_at (migración 0002/0039)';
  end if;
end
$$;

-- ==== 1. Catálogo único ====
create table if not exists public.residence_faq_predefined_questions (
  id text primary key check (id ~ '^FAQ-[0-9]{2,3}$'),
  category text not null check (category in (
    'antes_de_reservar', 'requisitos', 'costos_y_pagos', 'convivencia_y_reglas',
    'visitas', 'que_llevar', 'estadia_y_salida', 'privacidad_y_seguridad'
  )),
  question_text text not null check (char_length(btrim(question_text)) between 5 and 300),
  suggested_answer text not null check (char_length(btrim(suggested_answer)) between 1 and 3000),
  owner text not null check (owner in ('estured', 'residence')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists residence_faq_predefined_questions_updated_at on public.residence_faq_predefined_questions;
create trigger residence_faq_predefined_questions_updated_at before update on public.residence_faq_predefined_questions
  for each row execute function public.set_updated_at();

create index if not exists residence_faq_predefined_questions_order_idx
  on public.residence_faq_predefined_questions (category, display_order);

comment on table public.residence_faq_predefined_questions is
  'DR14: catálogo único de preguntas frecuentes. owner: estured = texto fijo (sin campos ni edición); residence = la residencia completa los {campos}. Lo administra el admin (service role).';

-- ==== 2. Selección y override por residencia ====
create table if not exists public.residence_faq_items (
  id uuid primary key default gen_random_uuid(),
  residence_id uuid not null references public.residences (id) on delete cascade,
  predefined_question_id text not null references public.residence_faq_predefined_questions (id) on delete cascade,
  is_selected boolean not null default false,
  answer_override text check (answer_override is null or char_length(btrim(answer_override)) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint residence_faq_items_unique unique (residence_id, predefined_question_id)
);

drop trigger if exists residence_faq_items_updated_at on public.residence_faq_items;
create trigger residence_faq_items_updated_at before update on public.residence_faq_items
  for each row execute function public.set_updated_at();

create index if not exists residence_faq_items_residence_idx
  on public.residence_faq_items (residence_id) where is_selected;

comment on table public.residence_faq_items is
  'DR14: preguntas del catálogo que la residencia eligió mostrar (is_selected) y su respuesta editada (answer_override; null = la sugerida). Público solo lo seleccionado de residencias verified_active; escribe solo service role.';

-- ==== 3. RLS ====
alter table public.residence_faq_predefined_questions enable row level security;
drop policy if exists faq_catalog_select_active on public.residence_faq_predefined_questions;
create policy faq_catalog_select_active on public.residence_faq_predefined_questions
  for select to anon, authenticated using (is_active);

alter table public.residence_faq_items enable row level security;
drop policy if exists faq_items_select_public on public.residence_faq_items;
create policy faq_items_select_public on public.residence_faq_items
  for select to anon, authenticated using (
    is_selected and residence_id in (select id from public.residences where status = 'verified_active')
  );
-- Sin policies de INSERT/UPDATE/DELETE: solo el service role escribe (server actions).

-- ==== 4. Grants ====
-- Solo lectura para la API (y filtrada por las policies de arriba); escribe únicamente el service role.
revoke all on public.residence_faq_predefined_questions from anon, authenticated;
revoke all on public.residence_faq_items from anon, authenticated;
grant select on public.residence_faq_predefined_questions to anon, authenticated;
grant select on public.residence_faq_items to anon, authenticated;

-- ==== 5. Carga del catálogo (49 FAQs de la Parte B de la propuesta; las 10 de texto fijo de EstuRed: FAQ-02, 03, 08, 10, 16, 17, 24, 44, 46, 47) ====
-- Idempotente: actualiza texto, tema, orden y owner; NO reactiva una pregunta que el admin desactivó (no toca is_active).
insert into public.residence_faq_predefined_questions (id, category, question_text, suggested_answer, owner, display_order) values
  ('FAQ-01', 'antes_de_reservar', $q$¿Puedo hacer una visita, presencial o virtual?$q$, $a$Sí podés pedir una visita {tipo_visita: presencial / virtual / ambas}. Se coordina con {contacto_visitas} en {dias_y_horarios_visita}. {requisitos_de_visita}. Para pedirla, escribinos a través de la solicitud o por {medio_contacto}.$a$, 'residence', 10),
  ('FAQ-02', 'antes_de_reservar', $q$¿Qué pasa cuando envío una solicitud?$q$, $a$Enviar una solicitud es gratis. La residencia revisa tu perfil y confirma si hay lugar. Hasta que lo confirme, la solicitud queda sujeta a confirmación. Vas a ver cada paso en tu cuenta.$a$, 'estured', 20),
  ('FAQ-03', 'antes_de_reservar', $q$¿Hay lugar disponible?$q$, $a$La disponibilidad la informa la residencia y puede cambiar. Si querés ingresar, enviá la solicitud: la residencia confirma si hay lugar para las fechas que elegiste.$a$, 'estured', 30),
  ('FAQ-04', 'antes_de_reservar', $q$¿Puede ingresar cualquiera?$q$, $a$No. La residencia evalúa cada solicitud. Para ingresar se pide {documentos_requeridos}, y se tiene en cuenta {criterios_de_admision} (por ejemplo, edad entre {edad_minima} y {edad_maxima}, actitud de convivencia). La decisión final es de la residencia.$a$, 'residence', 40),
  ('FAQ-05', 'antes_de_reservar', $q$¿Qué tipos de habitación hay?$q$, $a$Hay {tipos_de_habitacion}. {descripcion_por_tipo}. El detalle y los precios están en la ficha de la residencia.$a$, 'residence', 50),
  ('FAQ-06', 'antes_de_reservar', $q$¿Hay habitaciones con baño privado?$q$, $a${respuesta_banos}: sí, en {tipos_con_bano_privado} / no, los baños son compartidos (hay {cantidad_banos} para {cantidad_residentes}).$a$, 'residence', 60),
  ('FAQ-07', 'antes_de_reservar', $q$¿Qué servicios están incluidos?$q$, $a$Incluye {servicios_incluidos} (por ejemplo, internet, limpieza de espacios comunes, cocina equipada). No incluye {servicios_no_incluidos}.$a$, 'residence', 70),
  ('FAQ-08', 'antes_de_reservar', $q$¿Cómo elijo la fecha de ingreso?$q$, $a$En la solicitud elegís el mes de ingreso y la cantidad de meses (según el mínimo de la residencia). La fecha exacta se acuerda con la residencia después de hacer la reserva, y cualquier fracción de tarifa se acuerda de forma particular con ella.$a$, 'estured', 80),
  ('FAQ-09', 'antes_de_reservar', $q$¿Hay algún responsable en la residencia?$q$, $a$Sí. El responsable es {nombre_o_cargo_responsable}, que acompaña tu ingreso y atiende consultas {horario_atencion}. Contacto: {medio_contacto_responsable}.$a$, 'residence', 90),
  ('FAQ-10', 'antes_de_reservar', $q$¿Qué es una Residencia Verificada?$q$, $a$Es una residencia que EstuRed visitó en persona antes de publicarla. Revisamos la identidad del responsable, la ubicación y las fotos. EstuRed verifica a las residencias, no a las personas.$a$, 'estured', 100),
  ('FAQ-11', 'requisitos', $q$¿Cuáles son los requisitos para ingresar?$q$, $a$Se pide {documentos_requeridos}. Además: {requisitos_adicionales} (por ejemplo, constancia de alumno regular, certificado de antecedentes, datos de contacto de un familiar). Se completan en tu perfil de EstuRed y al ingresar a la residencia.$a$, 'residence', 110),
  ('FAQ-12', 'requisitos', $q$¿Qué es la matrícula de ingreso?$q$, $a$Es un pago {frecuencia_matricula: único / anual} de {monto_matricula} {moneda_cobro} que cubre {que_cubre_la_matricula}. Se paga a la residencia, no a EstuRed. Condiciones de devolución: {condicion_devolucion_matricula}. {si_no_cobra: Esta residencia no cobra matrícula.}$a$, 'residence', 120),
  ('FAQ-13', 'requisitos', $q$¿Puedo ingresar si soy menor de 18?$q$, $a${admite_menores: Sí / No}. Si admite, se necesita un familiar o responsable vinculado en EstuRed que acompañe el proceso: puede proponer opciones y seguir cada paso, y la decisión es de quien estudia. Condiciones de la residencia: {condiciones_menores}.$a$, 'residence', 130),
  ('FAQ-14', 'requisitos', $q$¿Qué documentos necesito si vengo de otro país?$q$, $a$Pasaporte o {documento_extranjeros}, y {documentacion_migratoria_requerida}. Si tenés dudas sobre trámites migratorios, consultá a tu institución educativa o a la autoridad correspondiente.$a$, 'residence', 140),
  ('FAQ-15', 'requisitos', $q$¿Tengo que ser estudiante regular?$q$, $a${requiere_estudiante_regular: Sí, con constancia de alumno regular / No es obligatorio, pero se prioriza ... / Otro}. {excepciones}.$a$, 'residence', 150),
  ('FAQ-16', 'costos_y_pagos', $q$¿Cuánto cuesta en total?$q$, $a$Enviar una solicitud es gratis. Si la reserva avanza, pagás a la residencia lo acordado (por ejemplo mensualidad, matrícula y depósito, según lo que figure en su ficha) y a EstuRed un fee del 5 %, sin contar el depósito. El monto exacto lo ves antes de pagar.$a$, 'estured', 160),
  ('FAQ-17', 'costos_y_pagos', $q$¿Qué es el fee EstuRed?$q$, $a$Es lo que cobra EstuRed por su servicio: 5 % del total de la estadía inicial, sin contar el depósito, que se paga una vez. Lo paga quien estudia o el familiar que designe. Recibís una factura a nombre de quien paga y, cuando la reserva se confirma, el comprobante de reserva con código verificable.$a$, 'estured', 170),
  ('FAQ-18', 'costos_y_pagos', $q$¿A quién y cómo le pago la mensualidad?$q$, $a$A la residencia, directamente, por {medios_de_pago} {datos_de_cobro_via_plataforma}. Del día {dia_inicio_pago} al {dia_fin_pago} de cada mes. EstuRed no cobra ni recibe ese dinero.$a$, 'residence', 180),
  ('FAQ-19', 'costos_y_pagos', $q$¿Hay depósito? ¿Cuándo se devuelve?$q$, $a${hay_deposito: Sí, de {monto_deposito} / No hay}. Se devuelve {plazo_devolucion_deposito} después de que te vas, según las condiciones de la residencia ({conceptos_descontables}). Lo devuelve la residencia, no EstuRed.$a$, 'residence', 190),
  ('FAQ-20', 'costos_y_pagos', $q$¿Qué pasa con la mensualidad si me ausento?$q$, $a${politica_ausencias}. Para que cuente, avisá con {preaviso_ausencia} a {contacto_administracion}.$a$, 'residence', 200),
  ('FAQ-21', 'costos_y_pagos', $q$¿El precio se ajusta durante la estadía?$q$, $a$Sí, {periodicidad_ajuste}, con {anticipacion_ajuste} de aviso. Criterio: {criterio_de_ajuste}. Cualquier propuesta de ajuste la ves en tu cuenta y la decisión es tuya.$a$, 'residence', 210),
  ('FAQ-22', 'costos_y_pagos', $q$¿Puedo reservar hoy para ingresar más adelante?$q$, $a${admite_ingreso_diferido: Sí / No}. {si_admite: Cobra {porcentaje_mes_vacio} de la mensualidad por cada mes hasta el ingreso, hasta {maximo_meses_mes_vacio} meses}. {condicion_cancelacion_diferido}.$a$, 'residence', 220),
  ('FAQ-23', 'costos_y_pagos', $q$¿En qué moneda se paga?$q$, $a$Los precios se muestran en USD con su equivalente referencial en pesos, actualizado a diario. La residencia cobra en {moneda_cobro}. El fee EstuRed se paga en ARS o USD según el medio elegido.$a$, 'residence', 230),
  ('FAQ-24', 'costos_y_pagos', $q$¿Puede pagar mi familia?$q$, $a$Sí. El fee EstuRed lo puede pagar un familiar vinculado, y la factura sale a su nombre. Los pagos a la residencia los coordinás con ella.$a$, 'estured', 240),
  ('FAQ-25', 'convivencia_y_reglas', $q$¿Hay toque de queda?$q$, $a${toque_de_queda: No, podés entrar y salir libremente / Sí, la residencia cierra a las {hora_cierre} y se avisa a {contacto_recepcion}}. {excepciones_horarias}. Respetá el silencio de {franjas_de_silencio}.$a$, 'residence', 250),
  ('FAQ-26', 'convivencia_y_reglas', $q$¿Cuáles son los horarios de silencio?$q$, $a$Se guarda silencio {franjas_de_silencio}. Para música o videos, auriculares.$a$, 'residence', 260),
  ('FAQ-27', 'convivencia_y_reglas', $q$¿Se puede fumar o tomar alcohol?$q$, $a$Fumar: {fumar_politica}. Alcohol: {alcohol_politica}. No se permite consumir sustancias ilegales ni ingresar en estado de ebriedad {otras_restricciones}.$a$, 'residence', 270),
  ('FAQ-28', 'convivencia_y_reglas', $q$¿Puedo llevar mascotas?$q$, $a${mascotas_politica}.$a$, 'residence', 280),
  ('FAQ-29', 'convivencia_y_reglas', $q$¿Con quién voy a compartir habitación?$q$, $a$En {tipos_compartidos} compartís con {cantidad_companeros}. La residencia {criterio_de_asignacion}. Podés pedir {pedidos_posibles}, sujeto a lo que la residencia pueda confirmar.$a$, 'residence', 290),
  ('FAQ-30', 'convivencia_y_reglas', $q$¿Cómo se limpia y quién limpia?$q$, $a$La residencia limpia {frecuencia_limpieza_comun}. En el día a día, cada residente mantiene ordenado su espacio y deja limpio lo que usa. Elementos de limpieza: {ubicacion_elementos_limpieza}.$a$, 'residence', 300),
  ('FAQ-31', 'convivencia_y_reglas', $q$¿Qué pasa si no se cumplen las reglas?$q$, $a$Según la gravedad: {medidas_resumen}. El detalle está en el reglamento de la residencia, que recibís al ingresar.$a$, 'residence', 310),
  ('FAQ-32', 'convivencia_y_reglas', $q$¿Puedo usar la cocina y la heladera?$q$, $a$Sí, de {hora_cocina_inicio} a {hora_cocina_fin}. {politica_heladeras}. Cada uno lava y guarda lo que usa.$a$, 'residence', 320),
  ('FAQ-33', 'visitas', $q$¿Se permiten visitas?$q$, $a${visitas_politica: Sí, de {horario_visitas}, en {espacios_para_visitas} / No}. Se avisan a {contacto_recepcion} {aviso_visitas}. Respondés por lo que haga tu invitado.$a$, 'residence', 330),
  ('FAQ-34', 'visitas', $q$¿Pueden quedarse a dormir mis visitas?$q$, $a${pernocte_politica: No / Sí, hasta {noches_maximas} con autorización de {quien_autoriza}}.$a$, 'residence', 340),
  ('FAQ-35', 'visitas', $q$Mi familia viene de visita. ¿Pueden conocer la residencia?$q$, $a${familia_visita_politica}: pueden conocerla en {horario_visitas}, avisando a {contacto_visitas}. Si todavía no sos residente, podés pedir una visita (ver «¿Puedo hacer una visita, presencial o virtual?»).$a$, 'residence', 350),
  ('FAQ-36', 'que_llevar', $q$¿Qué cosas tengo que llevar?$q$, $a$Llevá {lista_de_que_llevar}: por ejemplo, ropa de cama, toallas, artículos de higiene y un candado para el locker. La residencia provee {lista_provista}. No se permite {objetos_no_permitidos}.$a$, 'residence', 360),
  ('FAQ-37', 'que_llevar', $q$¿Hay lavandería?$q$, $a${lavanderia_politica}: sí, con cronograma en {lugar_cronograma} y {costo_lavanderia} / no, hay lavanderías cercanas.$a$, 'residence', 370),
  ('FAQ-38', 'que_llevar', $q$¿Cómo funciona la comida?$q$, $a${comida_politica}: cocinás vos en la cocina compartida / hay servicio de comida {detalle} / otra opción.$a$, 'residence', 380),
  ('FAQ-39', 'que_llevar', $q$¿Hay internet?$q$, $a${internet_politica}. Si el proveedor tiene una falla, la residencia hace el reclamo, pero la reparación depende de la empresa.$a$, 'residence', 390),
  ('FAQ-40', 'estadia_y_salida', $q$¿Cuánto es el tiempo mínimo de estadía?$q$, $a$El mínimo es de {meses_minimos} meses. Máximo: {meses_maximos} / sin máximo. Se elige en la solicitud.$a$, 'residence', 400),
  ('FAQ-41', 'estadia_y_salida', $q$¿Cómo renuevo?$q$, $a${renovacion_politica}. Hay un proceso claro: se ofrece y se acepta por ambas partes, y lo ves en tu cuenta.$a$, 'residence', 410),
  ('FAQ-42', 'estadia_y_salida', $q$¿Cómo aviso que me voy?$q$, $a$Avisá con {preaviso_egreso} a {contacto_administracion}. {efecto_economico_preaviso}. Se hace un recorrido de la habitación y se devuelve el depósito según las condiciones que figuran en la pregunta sobre el depósito.$a$, 'residence', 420),
  ('FAQ-43', 'estadia_y_salida', $q$¿Puedo cambiar de habitación?$q$, $a${cambio_habitacion_politica}. Se pide a {contacto_administracion}, sujeto a lo que la residencia pueda confirmar.$a$, 'residence', 430),
  ('FAQ-44', 'estadia_y_salida', $q$Si hay un problema, ¿a quién recurro?$q$, $a$Primero, hablá con la persona responsable de la residencia. Si no se resuelve o algo no coincide con lo acordado, podés abrir un caso con Soporte de EstuRed: revisamos la evidencia y hablamos con la residencia. Según el caso, puede corresponder la devolución del fee EstuRed. Soporte no reemplaza lo que acuerdan residencia y residente entre sí.$a$, 'estured', 440),
  ('FAQ-45', 'privacidad_y_seguridad', $q$¿Hay cámaras de seguridad?$q$, $a${camaras_politica: Sí, en {sectores_con_camaras} / No}. Las imágenes las ve solo {quien_accede_a_imagenes}, para seguridad y ante faltas graves, y se conservan {plazo_conservacion_imagenes}.$a$, 'residence', 450),
  ('FAQ-46', 'privacidad_y_seguridad', $q$¿Qué datos míos ve la residencia?$q$, $a$La residencia ve tu perfil cuando le enviás una solicitud. Vos elegís qué mostrar. Los perfiles de menores están ocultos por defecto.$a$, 'estured', 460),
  ('FAQ-47', 'privacidad_y_seguridad', $q$¿Qué ve mi familia?$q$, $a$Un familiar vinculado puede seguir cada paso del proceso y proponer opciones. No edita tu perfil ni tus documentos, no envía solicitudes por vos y no ve tus mensajes privados.$a$, 'estured', 470),
  ('FAQ-48', 'privacidad_y_seguridad', $q$¿Cómo es el acceso y qué pasa con mis cosas?$q$, $a$El acceso es {sistema_de_acceso}. Te recomendamos usar candado en tu locker. {responsabilidad_por_pertenencias}.$a$, 'residence', 480),
  ('FAQ-49', 'privacidad_y_seguridad', $q$¿Qué hago ante una emergencia de salud?$q$, $a${servicio_emergencias}: teléfono {telefono_emergencias}. Si hay riesgo inmediato, llamá primero al número de emergencias local.$a$, 'residence', 490)
on conflict (id) do update set
  category = excluded.category,
  question_text = excluded.question_text,
  suggested_answer = excluded.suggested_answer,
  owner = excluded.owner,
  display_order = excluded.display_order;

commit;

/**
 * Reglamento MODELO de EstuRed (DR14, docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md Parte A). Lógica pura, sin I/O.
 *
 * Es un modelo ORIENTATIVO: no es asesoramiento legal ni un contrato. Los campos entre `{llaves}` los completa cada residencia.
 * Sin reglamento propio publicado, la ficha muestra este modelo tal cual (los campos sin completar se leen como
 * «[a definir con la residencia]», ver `renderPlaceholders`). Si cambia el texto, subir `MODEL_VERSION`: la aceptación
 * guarda el hash del texto, así que una solicitud ya enviada conserva exactamente lo que se aceptó.
 *
 * Fuera de esta fase: la variante «multiple choice» (R1–R20) del documento de propuestas. Queda para una fase posterior.
 */

export const MODEL_VERSION = "modelo-2026-10";

export type ModelArticle = {
  n: number;
  section: string;
  title: string;
  /** `suggested` = [Obligatorio sugerido]; `optional` = [Opcional/Configurable]. Solo orienta a la residencia. */
  tag: "suggested" | "optional";
  body: string;
};

const S = "suggested" as const;
const O = "optional" as const;

export const MODEL_ARTICLES: readonly ModelArticle[] = [
  { n: 1, section: "Objeto y principios", title: "Objeto y aceptación", tag: S, body: "Este reglamento ordena la convivencia en {nombre_residencia}. Quien reside lo recibe al ingresar y declara haberlo leído. Aceptarlo es condición para residir. Las modificaciones se comunican por {medio_comunicacion} con {anticipacion_cambios} de anticipación." },
  { n: 2, section: "Objeto y principios", title: "Principios de convivencia", tag: S, body: "Respeto mutuo entre residentes y hacia el personal y las instalaciones; colaboración en el orden y la higiene; cuidado del descanso, el estudio y la tranquilidad. {texto_propio_de_valores}" },
  { n: 3, section: "Admisión e ingreso", title: "Requisitos de ingreso", tag: S, body: "Para ingresar se presenta: {documentos_requeridos} (por ejemplo, documento de identidad o pasaporte, constancia de alumno regular, otros). La residencia puede pedir documentación adicional con aviso previo. La admisión depende de la confirmación de la residencia." },
  { n: 4, section: "Admisión e ingreso", title: "Matrícula de ingreso", tag: O, body: "La residencia cobra una matrícula de {monto_matricula} {moneda_cobro}, con frecuencia {frecuencia_matricula} (única, anual u otra). Condición de devolución: {condicion_devolucion_matricula}. Se abona a la residencia, directamente." },
  { n: 5, section: "Admisión e ingreso", title: "Edad de los residentes", tag: O, body: "La residencia admite residentes de entre {edad_minima} y {edad_maxima} años, calculada a la fecha de ingreso." },
  { n: 6, section: "Admisión e ingreso", title: "Menores de edad", tag: S, body: "Los menores de 18 años ingresan con un familiar o responsable vinculado, que acepta este reglamento junto con el estudiante. Datos de contacto del responsable: {contacto_responsable_menor}. {condiciones_adicionales_menores}" },
  { n: 7, section: "Admisión e ingreso", title: "Fecha de ingreso", tag: S, body: "La fecha exacta de ingreso se acuerda con la residencia una vez enviada la solicitud. {politica_fraccion_de_mes}" },
  { n: 8, section: "Pagos y depósito", title: "Mensualidad", tag: S, body: "La mensualidad es de {monto_mensual} {moneda_cobro}, por {tipo_habitacion}. Se paga del día {dia_inicio_pago} al {dia_fin_pago} de cada mes, por {medios_de_pago}." },
  { n: 9, section: "Pagos y depósito", title: "Pago fuera de término", tag: O, body: "Si el pago no llega en fecha, se avisa a {contacto_administracion}. Consecuencia: {consecuencia_mora} (por ejemplo, recargo de {recargo_mora} por día, o ninguno)." },
  { n: 10, section: "Pagos y depósito", title: "Ausencias", tag: S, body: "Las ausencias (recesos, viajes, motivos personales) {politica_ausencias} sobre la mensualidad. Se avisa con {preaviso_ausencia} a {contacto_administracion}." },
  { n: 11, section: "Pagos y depósito", title: "Depósito", tag: O, body: "Depósito de {monto_deposito}, que se abona a la residencia. Se devuelve {plazo_devolucion_deposito} después del egreso, previa revisión del estado de la habitación y de {conceptos_descontables}. No forma parte del fee EstuRed." },
  { n: 12, section: "Pagos y depósito", title: "Ajustes de precio", tag: S, body: "Los ajustes se aplican {periodicidad_ajuste} y se comunican con {anticipacion_ajuste} de anticipación. Criterio: {criterio_de_ajuste}." },
  { n: 13, section: "Pagos y depósito", title: "Fee EstuRed (aclaración)", tag: S, body: "El fee de EstuRed (5 %) se paga una sola vez a EstuRed por quien estudia o por el familiar que designe, y no forma parte de la mensualidad, la matrícula ni el depósito. Esos conceptos se pagan a la residencia." },
  { n: 14, section: "Pagos y depósito", title: "Reserva con ingreso diferido (mes vacío)", tag: O, body: "Si la residencia admite reservar con ingreso en una fecha futura, cobra {porcentaje_mes_vacio} de la mensualidad por cada mes hasta el ingreso, hasta {maximo_meses_mes_vacio} meses. Condición si se cancela: {condicion_cancelacion_diferido}." },
  { n: 15, section: "Convivencia, horarios y silencio", title: "Respeto en la convivencia", tag: S, body: "Evitar portazos, gritos, música alta y ruidos molestos. Música y videos, con auriculares en habitaciones y espacios comunes." },
  { n: 16, section: "Convivencia, horarios y silencio", title: "Horarios de silencio", tag: S, body: "Se guarda silencio {franjas_de_silencio} (por ejemplo, desde {hora_silencio} y entre {hora_siesta_inicio} y {hora_siesta_fin})." },
  { n: 17, section: "Convivencia, horarios y silencio", title: "Ingreso y egreso de la residencia", tag: O, body: "{politica_horarios_ingreso}: sin restricciones de ingreso y egreso / horario de cierre {hora_cierre} con aviso previo / otro." },
  { n: 18, section: "Convivencia, horarios y silencio", title: "Circulación nocturna", tag: O, body: "Después de las {hora_circulacion_nocturna} no se circula por pasillos ni se permanece en habitaciones ajenas. Excepción: {excepcion_horario_nocturno} (por ejemplo, estudiantes con clases nocturnas, con constancia)." },
  { n: 19, section: "Convivencia, horarios y silencio", title: "Conductas no permitidas", tag: S, body: "No se permite: ingresar en estado de ebriedad, consumir sustancias ilegales, {fumar_o_vapear_politica}, subalquilar o ceder la cama, {otras_conductas_no_permitidas}. {conducta_sexual_politica}" },
  { n: 20, section: "Convivencia, horarios y silencio", title: "Bicicletas y objetos voluminosos", tag: O, body: "{politica_bicicletas}: no se ingresan al edificio / se guardan en {lugar_guardado}." },
  { n: 21, section: "Visitas", title: "Horario de visitas", tag: S, body: "Las visitas se reciben {horario_visitas}. Se anuncian a {contacto_recepcion} {aviso_visitas}." },
  { n: 22, section: "Visitas", title: "Dónde pueden estar las visitas", tag: S, body: "Las visitas permanecen en {espacios_para_visitas}. {ingreso_a_habitaciones_politica}." },
  { n: 23, section: "Visitas", title: "Pernocte de visitas", tag: O, body: "{politica_pernocte}: no se permite pernocte / se permite hasta {noches_maximas} con autorización previa de {quien_autoriza}." },
  { n: 24, section: "Visitas", title: "Responsabilidad por invitados", tag: S, body: "Cada residente responde por lo que haga quien invita." },
  { n: 25, section: "Visitas", title: "Excepciones de ingreso", tag: O, body: "Quienes dejaron de residir pueden visitar {politica_exresidentes} (por ejemplo, con autorización previa). No ingresan personas a las que la residencia haya restringido el acceso." },
  { n: 26, section: "Habitaciones", title: "Uso de la habitación", tag: S, body: "La habitación {uso_habitacion} (por ejemplo, descanso y estudio / solo descanso en las compartidas, con zona de estudio común). Cada residente mantiene su espacio ordenado y se acuerda con sus compañeros de habitación." },
  { n: 27, section: "Habitaciones", title: "Ropa de cama y toallas", tag: O, body: "{ropa_de_cama_politica}: cada residente trae las propias / la residencia las provee, con {frecuencia_cambio}." },
  { n: 28, section: "Habitaciones", title: "Alimentos en habitaciones", tag: O, body: "{alimentos_en_habitacion_politica}. No se dejan platos, vasos ni utensilios sucios." },
  { n: 29, section: "Habitaciones", title: "Artefactos eléctricos", tag: S, body: "Uso de artefactos eléctricos {artefactos_politica} (por ejemplo, con autorización de {quien_autoriza}). No se usan estufas, planchas ni calefactores no autorizados." },
  { n: 30, section: "Habitaciones", title: "Modificaciones del espacio", tag: S, body: "No se colocan carteles, no se pinta ni se altera el mobiliario sin autorización." },
  { n: 31, section: "Habitaciones", title: "Reubicación", tag: O, body: "La residencia puede reubicar residentes por {motivos_reubicacion}, con {aviso_reubicacion} de aviso." },
  { n: 32, section: "Cocinas, heladeras y lockers", title: "Uso de cocinas", tag: S, body: "Disponibles de {hora_cocina_inicio} a {hora_cocina_fin}. Cada residente lava y guarda lo que usa y deja la mesada limpia." },
  { n: 33, section: "Cocinas, heladeras y lockers", title: "Heladeras", tag: O, body: "{politica_heladeras}: heladera asignada por habitación / sector común. Los alimentos se rotulan y se guardan en recipientes. Compra sugerida: {pauta_de_compra}." },
  { n: 34, section: "Cocinas, heladeras y lockers", title: "Lockers y pertenencias", tag: O, body: "Cada residente dispone de {cantidad_lockers}. Se usa con candado propio y {contenido_permitido_lockers}." },
  { n: 35, section: "Cocinas, heladeras y lockers", title: "Orden y limpieza en cocina", tag: S, body: "El uso incorrecto o la falta de limpieza reiterada puede dar lugar a las medidas del Art. 53." },
  { n: 36, section: "Baños", title: "Uso de baños", tag: S, body: "Se dejan limpios después de usarlos. {tiempo_maximo_bano}. No se dejan objetos personales." },
  { n: 37, section: "Baños", title: "Agua caliente", tag: O, body: "El sistema de agua caliente es {tipo_agua_caliente} y se usa de forma responsable. Franjas de baja demanda sugeridas: {franjas_baja_demanda}." },
  { n: 38, section: "Baños", title: "Artículos de higiene", tag: O, body: "Cada residente trae {articulos_de_higiene_propios}. La residencia provee {articulos_de_higiene_provistos}." },
  { n: 39, section: "Espacios comunes", title: "Horarios de espacios comunes", tag: S, body: "Espacios disponibles: {lista_espacios_comunes}. Horario: de {hora_espacios_inicio} a {hora_espacios_fin}." },
  { n: 40, section: "Espacios comunes", title: "Terraza y espacios abiertos", tag: O, body: "Se usan hasta las {hora_cierre_terraza}. {fiestas_politica}." },
  { n: 41, section: "Espacios comunes", title: "Lavandería y salas con cronograma", tag: O, body: "Se usan según el cronograma de {lugar_cronograma}. Al terminar queda todo limpio y ordenado. {costo_lavanderia}." },
  { n: 42, section: "Espacios comunes", title: "Internet", tag: O, body: "{internet_politica}: incluido en la mensualidad / con costo de {costo_internet}. Ante una falla del proveedor, la residencia gestiona el reclamo, pero el tiempo de reparación depende de la empresa." },
  { n: 43, section: "Espacios comunes", title: "Zonas de uso específico", tag: O, body: "La zona de estudio es para estudiar; el comedor, para comer y compartir." },
  { n: 44, section: "Limpieza", title: "Frecuencia de limpieza", tag: S, body: "Espacios comunes y baños: {frecuencia_limpieza_comun}. Habitaciones: {frecuencia_limpieza_habitaciones}." },
  { n: 45, section: "Limpieza", title: "Colaboración diaria", tag: S, body: "Los elementos de limpieza están en {ubicacion_elementos_limpieza}. Se pide colaboración para mantener el orden entre una limpieza y otra." },
  { n: 46, section: "Seguridad", title: "Accesos", tag: S, body: "El acceso es por {sistema_de_acceso}. No se comparten códigos ni llaves con personas ajenas a la residencia, ni se hacen copias. No se deja la puerta abierta ni se da acceso a desconocidos." },
  { n: 47, section: "Seguridad", title: "Cámaras de seguridad", tag: O, body: "La residencia tiene {cantidad_camaras} cámaras en {sectores_con_camaras}, activas {horario_camaras}. Las imágenes las ve solo {quien_accede_a_imagenes}, con fines de seguridad y ante faltas graves. Se conservan {plazo_conservacion_imagenes}. Este artículo trata datos personales: conviene revisarlo con un profesional." },
  { n: 48, section: "Seguridad", title: "Emergencias de salud", tag: O, body: "Servicio de emergencias: {servicio_emergencias}. Teléfono: {telefono_emergencias}. Los residentes informan {datos_de_salud_a_informar} solo si lo consideran necesario." },
  { n: 49, section: "Seguridad", title: "Instalaciones eléctricas y de agua", tag: S, body: "No se manipulan instalaciones eléctricas ni de agua. Cualquier desperfecto se avisa a {contacto_mantenimiento}." },
  { n: 50, section: "Seguridad", title: "Pertenencias personales", tag: S, body: "Cada residente cuida sus pertenencias. Se recomienda usar candado. {responsabilidad_por_pertenencias}" },
  { n: 51, section: "Responsable de la residencia", title: "Rol del responsable", tag: S, body: "El responsable es {nombre_o_cargo_responsable}. Su función: acompañar el ingreso y explicar los puntos clave de este reglamento, ser referente ante consultas y conflictos, y aplicar las medidas del Art. 53." },
  { n: 52, section: "Responsable de la residencia", title: "Cómo contactar", tag: S, body: "Por {medio_contacto_responsable}, en {horario_atencion}. En ausencia, lo reemplaza {reemplazo_responsable}." },
  { n: 53, section: "Medidas por incumplimiento", title: "Tipos de medida", tag: S, body: "Según la gravedad o la repetición: llamado de atención oral con registro interno; advertencia escrita; {medida_intermedia_opcional}; terminación de la estadía en faltas graves. {politica_multas}" },
  { n: 54, section: "Medidas por incumplimiento", title: "Procedimiento", tag: O, body: "Antes de una terminación de estadía se informa al residente el motivo y se le ofrece {oportunidad_de_respuesta}. Faltas graves que habilitan terminación inmediata: {lista_faltas_graves}. {devolucion_en_caso_de_terminacion}" },
  { n: 55, section: "Medidas por incumplimiento", title: "Registro y renovaciones", tag: O, body: "Las medidas quedan registradas internamente y {efecto_en_renovacion}." },
  { n: 56, section: "Medidas por incumplimiento", title: "Derecho de admisión y permanencia", tag: O, body: "{texto_derecho_admision}" },
  { n: 57, section: "Egreso", title: "Aviso de egreso", tag: S, body: "Se avisa con {preaviso_egreso} a {contacto_administracion}. {efecto_economico_preaviso}." },
  { n: 58, section: "Egreso", title: "Estado de la habitación al salir", tag: S, body: "Se entrega en {estado_de_entrega}, con las llaves y accesos. Se hace un recorrido con {quien_recorre}." },
  { n: 59, section: "Egreso", title: "Devolución del depósito", tag: O, body: "Se devuelve en {plazo_devolucion_deposito}, descontando solo {conceptos_descontables}, con detalle por escrito." },
  { n: 60, section: "Aceptación", title: "Declaración de aceptación", tag: S, body: "Declaro haber leído y comprendido el reglamento y me comprometo a convivir con respeto, cuidar los espacios, respetar los horarios y al personal, y asumir mi responsabilidad individual. En caso de menor de edad, también acepta el familiar o responsable vinculado." },
  { n: 61, section: "Aceptación", title: "Cambios del reglamento", tag: S, body: "La residencia puede actualizarlo con el aviso del Art. 1. Los cambios rigen desde {vigencia_cambios} y no afectan lo ya pagado." },
];

/** Aviso fijo de la propuesta (docs/08 §7.16): el modelo es orientativo. */
export const MODEL_LEGAL_NOTE =
  "Este modelo es orientativo: no es asesoramiento legal ni un contrato. Cada residencia lo adapta a su realidad y a la normativa que le aplique, y conviene que un profesional lo revise (sobre todo cámaras, medidas por incumplimiento, menores y devolución del depósito). EstuRed es una plataforma intermediaria: no redacta ni firma contratos entre residencia y residente, y no fija lo que cobra la residencia.";

/** Texto plano del modelo (secciones y artículos), con los `{campos}` sin completar. Es el punto de partida del editor. */
export function buildModelText(articles: readonly ModelArticle[] = MODEL_ARTICLES): string {
  const out: string[] = [];
  let section = "";
  for (const a of articles) {
    if (a.section !== section) {
      section = a.section;
      out.push(section.toUpperCase());
    }
    out.push(`Art. ${a.n}. ${a.title}\n${a.body}`);
  }
  return out.join("\n\n");
}

/** Campos `{...}` sin completar que quedan en un texto. */
export function findPlaceholders(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{([a-z0-9_]+)\}/gi), (m) => m[1])));
}

/** Para MOSTRAR el modelo sin adaptar: cada campo queda como «[a definir con la residencia]». No se usa para el hash. */
export function renderPlaceholders(text: string): string {
  return text.replace(/\{[a-z0-9_]+\}/gi, "[a definir con la residencia]");
}

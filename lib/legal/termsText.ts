/**
 * Texto de `/terms` (Términos y condiciones para estudiantes y familias). Base: `docs/21`; las cláusulas de fee, precios,
 * responsabilidad, modificaciones y jurisdicción vienen de TP-03 (`docs/audits/TEXTOS_LEGALES_PROVISORIOS_2026-11-21.md`,
 * Ola 0 de la auditoría legal). Es dato puro: la página lo muestra y `lib/legal/consentVersion.ts` calcula su hash.
 */
import { LEGAL_OPERATOR } from "@/lib/legal/operator";
import { REVOCATION_TERMS_PARAGRAPHS } from "@/lib/revocations/copy";

export interface TermsSection {
  /** Ancla para enlazar la sección (ej. `quienes-somos`). */
  id?: string;
  title: string;
  paras?: string[];
  items?: string[];
  defs?: [term: string, text: string][];
  sub?: { title: string; paras?: string[]; items?: string[] };
}


export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "quienes-somos",
    title: "Quiénes somos",
    paras: [
      `EstuRed es el nombre de fantasía de la plataforma operada por ${LEGAL_OPERATOR.fullName}, CUIT ${LEGAL_OPERATOR.cuit}, con domicilio en ${LEGAL_OPERATOR.domicile}. En estos términos lo llamamos «EstuRed» o «el titular».`,
      `Contacto general: ${LEGAL_OPERATOR.contactEmail}. Consultas y pedidos sobre tus datos personales: ${LEGAL_OPERATOR.privacyEmail}.`,
    ],
  },
  {
    title: "1. Quiénes quedan alcanzados y aceptación",
    paras: [
      "Estos términos regulan el uso de EstuRed por parte de estudiantes; padres, madres o familiares vinculados; y usuarios registrados que exploran residencias, envían o aprueban solicitudes, pagan fees, cargan documentación o participan en procesos de reserva, ajuste de condiciones, renovación, lista de espera, comunidad visible o Soporte.",
      "Al registrarte, crear una cuenta, vincularte como familiar, enviar o aprobar una solicitud, responder a una propuesta de ajuste de condiciones, pagar el fee EstuRed, cargar documentación, activar un perfil visible o usar cualquier funcionalidad de la plataforma, declarás haber leído y aceptado estos términos, la política de privacidad, las reglas de visibilidad, las condiciones de uso de datos y los avisos específicos que se muestren en cada paso crítico.",
    ],
  },
  {
    title: "2. Qué es EstuRed",
    paras: [
      "EstuRed es una plataforma intermediaria que facilita la búsqueda, comparación, solicitud, negociación estructurada de condiciones, reserva registrada, cobro y facturación del fee de servicio, emisión de comprobantes, soporte operativo, lista de espera, renovaciones y herramientas de confianza vinculadas a residencias estudiantiles.",
      "EstuRed no es propietaria, operadora ni administradora directa de las residencias publicadas, salvo acuerdo específico por escrito. No presta directamente el alojamiento ofrecido por las residencias y no garantiza el comportamiento futuro de residencias, estudiantes, familiares, residentes, personal de residencia ni terceros.",
      "EstuRed puede actuar como plataforma de búsqueda; canal de solicitud; registrador de operaciones; emisor de comprobantes de reserva o renovación confirmada; emisor del comprobante fiscal correspondiente a su propio fee de servicio; canal de Soporte; e intermediario operativo.",
      "La prestación efectiva del alojamiento, las reglas internas, los pagos mensuales, las condiciones de permanencia, la convivencia, los servicios incluidos y las obligaciones propias de la residencia corresponden a cada residencia.",
    ],
  },
  {
    title: "3. Definiciones",
    defs: [
      ["Estudiante", "usuario que busca, solicita, reserva o reside en una residencia estudiantil dentro de EstuRed."],
      [
        "Familiar vinculado",
        "padre, madre, tutor, responsable económico o familiar que se vincula a la cuenta de un estudiante con autorización del estudiante. Puede acompañar operativamente, cargar documentación, proponer solicitudes de reserva sujetas a aprobación del estudiante, pagar el fee EstuRed y acceder a comprobantes según permisos.",
      ],
      ["Residencia", "alojamiento estudiantil publicado y verificado por EstuRed."],
      [
        "Residencia Verificada",
        "residencia cuya identidad responsable, dirección y similitud básica con las fotos publicadas fueron revisadas por EstuRed mediante un proceso de verificación presencial. Este sello no implica garantía absoluta sobre la totalidad de servicios, convivencia futura, cumplimiento contractual o comportamiento de las partes.",
      ],
      [
        "Propuesta de solicitud del familiar",
        "sugerencia que un familiar vinculado le hace al estudiante para enviar una solicitud a una residencia determinada. No es visible para la residencia ni produce efecto alguno hasta que el estudiante la apruebe.",
      ],
      [
        "Solicitud de reserva",
        "manifestación de interés enviada por el estudiante, directamente o mediante la aprobación de una propuesta del familiar, para avanzar con una residencia. No confirma automáticamente la reserva.",
      ],
      [
        "Contacto establecido",
        "estado en el cual una residencia decide avanzar con una solicitud y habilita el contacto estructurado con el estudiante (o con el familiar, cuando la solicitud la inició este último o el estudiante es menor de edad) para coordinar el pago requerido por la residencia.",
      ],
      [
        "Propuesta de ajuste de condiciones",
        "comunicación formal que la residencia puede enviar, una única vez por cada solicitud, para modificar condiciones como tarifa, tipo de habitación, fecha de ingreso, duración, depósito, matrícula, política de ajustes o monto requerido para reservar.",
      ],
      [
        "Pago a la residencia",
        "pago realizado directamente por el estudiante o el familiar a la residencia, en concepto de seña, matrícula, depósito, reserva u otro concepto configurado por la residencia.",
      ],
      [
        "Fee EstuRed",
        "cargo de servicio abonado a EstuRed por el estudiante o el familiar. Se calcula como el 5% del total de la estadía inicial reservada, sobre las condiciones finalmente aceptadas por el estudiante, incluyendo matrícula o cargos obligatorios no reembolsables y excluyendo el depósito reembolsable. Puede abonarse en pesos argentinos o en dólares estadounidenses, según los medios de pago habilitados por EstuRed.",
      ],
      [
        "Reserva confirmada",
        "estado alcanzado cuando la residencia informa que recibió el pago requerido y el fee EstuRed fue abonado correctamente.",
      ],
      [
        "Comprobante de Reserva Confirmada / de Renovación Confirmada",
        "documento emitido por EstuRed una vez confirmada la reserva o la renovación dentro de la plataforma.",
      ],
      [
        "Comprobante fiscal del fee EstuRed",
        "documento fiscal emitido por EstuRed a nombre de quien abona el fee, una vez confirmado su pago.",
      ],
      [
        "Lista de espera",
        "manifestación de interés en una residencia sin disponibilidad actual. No equivale a una solicitud activa hasta que el estudiante decida activar una solicitud.",
      ],
      [
        "Comunidad visible",
        "información de residentes, habitaciones, plazas y perfiles visibles según permisos y consentimiento de los usuarios.",
      ],
    ],
  },
  {
    title: "4. Registro de cuenta",
    paras: [
      "Para usar las funciones completas de EstuRed hay que crear una cuenta. El registro de estudiante puede requerir: nombre, apellido, nacionalidad, fecha de nacimiento, lugar donde vas a estudiar, email, teléfono, contraseña, objetivo académico declarado, ciudad de origen, carrera o área de estudio, hábitos e intereses (si aplica), configuración de visibilidad, y documentación opcional o requerida por residencias.",
      "Tu apellido completo, email, teléfono, fecha de nacimiento, universidad y documentos personales nunca se muestran públicamente.",
      "Declarás que la información que cargás es verdadera, actualizada y propia. EstuRed puede pedirte correcciones o documentación adicional, o suspender funcionalidades si detecta datos falsos, inconsistentes, abusivos o riesgosos.",
    ],
  },
  {
    title: "5. Estudiantes menores de edad",
    paras: [
      "Si el estudiante es menor de edad, debe contar obligatoriamente con un familiar vinculado para finalizar el registro y avanzar en operaciones relevantes. El familiar vinculado debe aprobar, acompañar o intervenir en los pasos que EstuRed determine para menores.",
      "EstuRed puede bloquear solicitudes, propuestas de solicitud, pagos, comunidad visible o documentación cuando el estudiante menor no tenga un vínculo familiar activo, y puede aplicar controles reforzados y exigir una aceptación adicional del familiar vinculado.",
      "El estudiante, incluso siendo menor de edad, es quien aprueba o rechaza una propuesta de solicitud enviada por su familiar vinculado. El familiar no puede aprobarla en su representación bajo ninguna circunstancia.",
      "Cuando el estudiante es menor de edad, el contacto que establezca la residencia se dirige siempre al familiar vinculado, independientemente de quién haya iniciado la solicitud. Por eso, el teléfono del familiar vinculado es un dato obligatorio para que un estudiante menor pueda enviar o aprobar solicitudes.",
    ],
  },
  {
    title: "6. Familiar vinculado",
    paras: [
      "El familiar vinculado puede acompañar el proceso del estudiante, pero no reemplaza su decisión, ni siquiera cuando el estudiante es menor, salvo lo indicado en la sección anterior.",
    ],
    items: [
      "Un estudiante puede tener solo un familiar vinculado activo; un familiar puede estar vinculado a más de un estudiante.",
      "La vinculación requiere aprobación del estudiante, excepto cuando el estudiante es menor y el flujo exige la vinculación obligatoria. El estudiante mayor de edad puede revocar el vínculo.",
      "El familiar puede proponer una solicitud de reserva al estudiante, pero esa propuesta solo se convierte en una solicitud real, y solo entonces resulta visible para la residencia, si el estudiante la aprueba expresamente.",
      "Si el estudiante aprueba una propuesta iniciada por el familiar, el contacto posterior de la residencia se dirige al familiar, no al estudiante.",
      "El familiar puede pagar el fee EstuRed de una solicitud o renovación, cargar documentación, subir comprobantes y acceder a comprobantes según permisos.",
      "El familiar no puede modificar la identidad del estudiante, aceptar una propuesta de ajuste de condiciones en su nombre, ni actuar de forma incompatible con la voluntad del estudiante.",
    ],
    sub: {
      title: "Quién figura en los comprobantes",
      paras: [
        "Si el familiar realiza un pago, el comprobante fiscal del fee EstuRed se emite a nombre de quien paga. El comprobante de reserva o renovación identifica al estudiante como beneficiario de la operación.",
      ],
    },
  },
  {
    title: "7. Perfil del estudiante, comunidad visible, hábitos e intereses",
    paras: [
      "El estudiante puede configurar la visibilidad de su perfil. Según su configuración, pueden mostrarse: nombre e inicial, foto real (si la acepta) o avatar, edad, nacionalidad o bandera, carrera o área de estudio, ciudad de origen, hábitos e intereses. Nunca se muestran públicamente: apellido completo, email, teléfono, fecha de nacimiento, universidad, documentos personales ni datos sensibles que no sean necesarios para la finalidad de alojamiento.",
      "Los usuarios invitados tienen acceso limitado. Los usuarios registrados pueden ver perfiles individuales de residentes según los permisos configurados por cada estudiante.",
      "La residencia puede invitar a un residente a activar su cuenta, pero no puede obligarlo a mostrar un perfil completo. Si el residente no activa la cuenta o limita su visibilidad, puede aparecer como plaza ocupada o residente pendiente de activar cuenta, sin datos personales adicionales.",
      "El contenido de una propuesta de solicitud realizada por un familiar nunca es visible para la residencia ni para terceros mientras esté pendiente de aprobación del estudiante.",
      "Los hábitos e intereses ayudan a entender la convivencia y el perfil general de la comunidad. Pueden incluir, según tu configuración: horarios aproximados, rutina de estudio o trabajo, preferencia de limpieza, tolerancia al ruido, uso de espacios comunes, preferencia sobre visitas, si fumás o no (cuando es relevante para las reglas de la residencia) e intereses generales. EstuRed no solicita ni publica datos sensibles innecesarios, como salud, religión, ideología política, orientación sexual o situación económica detallada.",
    ],
  },
  {
    title: "8. Documentación del estudiante",
    paras: [
      "El estudiante o el familiar vinculado puede cargar documentos dentro de EstuRed. La documentación puede servir para mejorar la calidad de una solicitud, facilitar la admisión, respaldar la identidad o cumplir requisitos de una residencia; su carga puede ser opcional o requerida por una residencia para avanzar.",
      "La residencia solo puede acceder a documentos autorizados y vinculados a una solicitud, reserva, renovación, estadía o proceso operativo correspondiente. No tiene acceso global irrestricto a todos los documentos cargados por el estudiante.",
      "EstuRed puede registrar auditoría sobre el acceso, carga, descarga, reemplazo o eliminación de documentos. Declarás que los documentos que cargás son verdaderos, propios y pertinentes.",
    ],
  },
  {
    title: "9. Búsqueda de residencias y disponibilidad",
    paras: [
      "Podés buscar residencias en EstuRed, inicialmente con foco en CABA. Las fichas pueden mostrar fotos, ubicación o zona, servicios, reglas, composición de habitaciones, precios en USD y ARS, matrícula, depósito, política de ajustes, disponibilidad, comunidad visible (si aplica), condiciones de reserva, el sello de Residencia Verificada y preguntas frecuentes con información cargada por la residencia.",
      "La disponibilidad que se muestra es informada por la residencia y requiere confirmación al solicitar. Cuando una residencia usa Gestión Operativa y mantiene actualizado su inventario de habitaciones y plazas, la información puede ser más precisa.",
      "Entendés que ver disponibilidad no implica una reserva automática ni una garantía absoluta de disponibilidad hasta completar el proceso de confirmación.",
    ],
  },
  {
    title: "10. Tarifas, moneda y tipo de cambio",
    paras: [
      "EstuRed puede mostrar tarifas en dólares estadounidenses y pesos argentinos. El fee EstuRed puede abonarse en pesos o en dólares, según el medio de pago que elijas entre los habilitados.",
      "Las conversiones en pantalla usan la fuente de tipo de cambio configurada por EstuRed. El valor en pesos es referencial y el valor final se acuerda directamente con la residencia al momento del pago efectivo.",
      "Cada solicitud guarda un snapshot con: tarifa en USD y en ARS, tipo de cambio utilizado, fecha y hora del cálculo, duración inicial declarada, matrícula, depósito, política de ajustes, base de cálculo del fee y fee EstuRed estimado o final. Si la residencia envía una propuesta de ajuste de condiciones y la aceptás, se genera un nuevo snapshot con los valores acordados, que reemplaza al original a efectos del cálculo del fee y del comprobante.",
      "Las tarifas de meses futuros pueden estar sujetas a modificaciones según la política de ajuste de cada residencia, que es responsable de informar si aplica ajuste mensual, trimestral, semestral, anual o ninguno. El fee EstuRed se calcula sobre las condiciones finalmente aceptadas y no considera ajustes futuros.",
    ],
  },
  {
    title: "11. Propuesta de solicitud del familiar",
    paras: [
      "El familiar vinculado puede proponerle al estudiante el envío de una solicitud de reserva a una residencia determinada. Esta propuesta no es una solicitud real ni es visible para la residencia. El estudiante debe revisarla y puede aprobarla o rechazarla, sin poder modificar sus términos; si quiere otros términos, debe rechazarla y pedirle una nueva al familiar, o iniciar su propia solicitud.",
      "Si el estudiante no responde dentro de las 48 horas siguientes a la creación de la propuesta, esta vence automáticamente y el familiar es notificado.",
      "Si el estudiante la aprueba, se convierte en una solicitud real, sujeta a las mismas reglas que cualquier otra, incluyendo el límite de solicitudes activas. Como la solicitud fue originada por el familiar, el contacto que eventualmente establezca la residencia se dirige a este último. Las propuestas pendientes de aprobación no computan dentro del límite de solicitudes activas del estudiante.",
    ],
  },
  {
    title: "12. Solicitudes de reserva",
    paras: [
      "Enviar una solicitud de reserva, directamente o mediante la aprobación de una propuesta del familiar, no confirma automáticamente la reserva. Al enviarla o aprobarla, el estudiante declara su interés en avanzar con una residencia bajo las condiciones visibles y registradas en el snapshot de la solicitud. Las solicitudes quedan sujetas a confirmación de la residencia.",
    ],
    items: [
      "El estudiante puede tener hasta 2 solicitudes activas; si una avanza, la otra queda pausada; si una reserva se confirma, las demás solicitudes activas se cierran.",
      "Una plaza puede tener hasta 3 solicitudes visibles y 2 en cola; la residencia solo puede avanzar con una solicitud por plaza a la vez.",
      "La residencia puede rechazar solicitudes con motivo interno. Una solicitud puede vencer si no hay respuesta o avance dentro de los plazos establecidos.",
      "Cuando la residencia establece contacto, el estudiante o, en su caso, el familiar que originó la solicitud tiene 48 horas para realizar el pago requerido por la residencia.",
      "La solicitud vence a las 48 horas desde su envío si no existe avance suficiente. Al vencer, el estudiante puede pedir actualizarla con los mismos parámetros, para verificar si la residencia mantiene disponibilidad y cuál sería la tarifa aproximada vigente.",
    ],
  },
  {
    title: "13. Propuesta de ajuste de condiciones y snapshot",
    paras: [
      "Después de establecido el contacto, la residencia puede enviar, una única vez por cada solicitud, una propuesta formal de ajuste sobre las condiciones originalmente informadas (tarifa, tipo de habitación, fecha de ingreso, duración, depósito, matrícula, política de ajustes o monto requerido para reservar). La propuesta no puede modificar tus datos personales.",
      "Vas a ver una comparación entre las condiciones originales y las propuestas, y vas a poder: aceptarla, en cuyo caso las nuevas condiciones reemplazan a las originales, incluso para el cálculo del fee EstuRed; rechazarla y continuar con las condiciones originales; o rechazarla y cerrar la solicitud.",
      "El plazo de 48 horas para completar el pago a la residencia se reinicia cuando se envía una propuesta de ajuste.",
      "Las conversaciones o acuerdos informales entre el estudiante o el familiar y la residencia, incluidos los mantenidos por WhatsApp, no modifican las condiciones de la solicitud a menos que se formalicen mediante este mecanismo.",
      "El sistema conserva el snapshot original de la solicitud y, cuando corresponde, un snapshot final con la propuesta de ajuste aceptada. Todos los cálculos posteriores (incluido el fee EstuRed y el contenido del comprobante) se basan en el snapshot final vigente.",
    ],
  },
  {
    title: "14. Contacto establecido y pago a la residencia",
    paras: [
      "Cuando la residencia decide avanzar con una solicitud, se habilita el contacto estructurado con el estudiante o, si la solicitud fue iniciada por un familiar o el estudiante es menor, con el familiar vinculado. Ese contacto consiste en un enlace que abre WhatsApp con un mensaje pre-formateado, que la residencia envía manualmente. EstuRed no participa ni tiene acceso al contenido de esa conversación.",
      "El pago requerido para asegurar la plaza se hace directamente a la residencia, por los medios que ella indique (transferencia bancaria, billetera virtual, efectivo u otros). Puede corresponder a seña, matrícula, depósito, cargo de reserva u otro concepto informado por la residencia.",
      "La residencia configura previamente sus parámetros de matrícula, depósito y monto requerido para reservar. Esos montos no pueden modificarse caso por caso dentro de una solicitud activa, salvo mediante la propuesta formal de ajuste.",
      "Podés cargar el comprobante de tu pago a la residencia como referencia, pero ese comprobante no confirma por sí solo la reserva dentro de EstuRed. La residencia debe marcar Pago recibido únicamente cuando efectivamente haya recibido el pago.",
      "El pago de la reserva y las mensualidades los cobra la residencia, directamente. EstuRed no recibe, no retiene y no administra ese dinero.",
      "Los datos de cobro que ves los carga la residencia, que responde por ellos. EstuRed no los revisa ni los aprueba, y no responde por el medio de pago ni por la cuenta de destino.",
      "Las devoluciones de lo que pagaste a la residencia se acuerdan con la residencia. Si tenés un problema, escribinos a Soporte. Esto no limita los derechos que te da la ley como consumidor.",
    ],
  },
  {
    title: "15. Fee EstuRed",
    paras: [
      "El fee EstuRed lo abona el estudiante o el familiar. Equivale al 5% del total de la estadía inicial reservada, calculado sobre las condiciones finalmente aceptadas por el estudiante (las originales, o las de una propuesta de ajuste aceptada), sin considerar ajustes futuros.",
    ],
    items: [
      "Incluye: tarifa de alojamiento por la duración inicial reservada, matrícula y cargo de ingreso obligatorio no reembolsable.",
      "Excluye: depósito reembolsable, servicios opcionales, consumos variables, multas, cargos no obligatorios y ajustes futuros de tarifa.",
      "Se cobra después de que la residencia informa que recibió el pago requerido para asegurar la reserva.",
      "Se paga por los medios que te mostramos en la pantalla del fee, a cuentas de EstuRed. Validamos el pago en forma manual. Si hay un problema con el pago, te avisamos y podés volver a enviarlo.",
      "Sin fee pagado, la reserva no queda confirmada. Cuando el fee queda validado, recibís el comprobante de reserva. El comprobante no es una factura.",
      "La factura del fee (Factura C) se emite a nombre de quien pagó, según la normativa fiscal aplicable.",
    ],
  },
  {
    title: "16. Medios de pago",
    paras: [
      "Para el fee EstuRed elegís uno de los medios que EstuRed tenga habilitados en la pantalla del fee. Según el medio, pagás en pesos argentinos o en dólares estadounidenses. Ese medio sirve solo para el fee, no para los pagos a la residencia.",
      "Al avisar que pagaste el fee tenés que cargar el comprobante y esperar la validación.",
      "Las residencias publican sus precios en dólares estadounidenses. El importe en pesos es una referencia: lo calculamos con la cotización del día de la fuente configurada por EstuRed y lo redondeamos a múltiplos de 500 pesos. El importe final del pago a la residencia lo fija la residencia al momento de cobrar.",
      "Los medios de pago a la residencia los define cada residencia.",
    ],
  },
  {
    title: "17. Reembolso del fee y derecho de revocación",
    paras: [
      "El fee EstuRed no es reembolsable si el estudiante cancela por decisión propia, no se presenta, decide no continuar o incumple los pasos necesarios para sostener la reserva, salvo el derecho de revocación descripto más abajo.",
      "El fee puede ser evaluado para reintegro si la cancelación, el incumplimiento o la falta sustancial fuera atribuible a la residencia y luego de la revisión de EstuRed, sujeto a la normativa aplicable. EstuRed puede solicitar evidencia, contactar a las partes y evaluar el caso antes de resolver.",
      "El arrepentimiento y los reintegros del fee no incluyen lo que pagaste a la residencia. Lo que pagás a la residencia se rige por lo que acuerdes con ella. Nada de esto limita los derechos que te da la ley como consumidor.",
    ],
    sub: {
      title: "Derecho de revocación del fee EstuRed",
      paras: [...REVOCATION_TERMS_PARAGRAPHS],
    },
  },
  {
    title: "18. Reserva confirmada y comprobante",
    paras: [
      "Una reserva se considera confirmada dentro de EstuRed únicamente cuando la residencia marcó Pago recibido, el fee EstuRed fue abonado correctamente, la reserva quedó registrada en el sistema y se habilitó la emisión del Comprobante de Reserva Confirmada. Antes de ese momento la operación puede estar en proceso, pero no es una reserva confirmada.",
      "Al confirmarse, obtenés: el registro de la operación dentro de EstuRed, el Comprobante de Reserva Confirmada, el comprobante fiscal del fee abonado, acceso a Soporte y la posibilidad de seguimiento y renovación.",
      "El comprobante puede incluir: ID de reserva, código verificable y QR de verificación pública, fecha de emisión, datos del estudiante, datos del familiar pagador (si aplica), datos de la residencia, fecha estimada de ingreso, duración inicial declarada, objetivo académico declarado, tipo de habitación o plaza, condiciones finales aceptadas, monto abonado a la residencia (informado por la residencia), fee EstuRed, política de ajustes, aclaraciones operativas, disclaimer de responsabilidad y contacto de Soporte.",
      "El comprobante no reemplaza contratos, reglamentos, recibos, facturas u otros documentos que correspondan entre estudiante y residencia. Cualquier persona puede verificar su autenticidad con el código de verificación, sin iniciar sesión; la verificación pública muestra información limitada y nunca datos sensibles.",
      "El objetivo académico declarado es obligatorio para emitir el comprobante. Puede usarse para contextualizar la estadía, respaldar trámites o acompañar documentación de la reserva, y declarás que es verdadero y pertinente.",
    ],
  },
  {
    title: "19. Renovaciones",
    paras: [
      "EstuRed puede permitir renovaciones de estadía dentro de la plataforma. La residencia puede emitir una oferta formal de renovación con: período renovado, tarifa actual, moneda, política de ajustes, monto requerido para asegurar la renovación (si aplica), fecha límite de aceptación y condiciones específicas. El estudiante puede aceptarla o rechazarla.",
      "El estudiante también puede solicitar una renovación, pero esa solicitud no es una oferta formal hasta que la residencia la emita.",
      "El fee de renovación se calcula con la misma lógica que el de la reserva inicial: 5% del total del período renovado, sobre la tarifa actual, sin considerar ajustes futuros y excluyendo depósitos reembolsables. Una vez confirmada la renovación y abonado el fee, se emite un Comprobante de Renovación Confirmada junto con el comprobante fiscal correspondiente.",
    ],
  },
  {
    title: "20. Lista de espera",
    paras: [
      "Cuando una residencia no tiene disponibilidad, podés sumarte a su lista de espera. Estar en lista de espera no cuenta como una de las 2 solicitudes activas, y no equivale a una solicitud activa hasta que decidas activar una. Si aparece disponibilidad, EstuRed puede notificarte.",
      "La residencia puede contactarte o manifestar interés en estudiantes de la lista de espera, pero la solicitud solo se activa si decidís avanzar. Si confirmás una reserva en otra residencia dentro de EstuRed, se te remueve automáticamente de otras listas de espera.",
      "A los 90 días, EstuRed puede notificarte para confirmar si querés seguir en la lista, pero no se te elimina automáticamente por el solo paso del tiempo. La residencia puede eliminar manualmente estudiantes de su lista, dejando registro de la acción.",
    ],
  },
  {
    title: "21. No-show y cancelaciones",
    paras: [
      "Si el estudiante no se presenta en la fecha y hora acordadas de ingreso y la residencia no logra comunicarse por canales razonables dentro de las 24 horas posteriores, la residencia puede marcar el caso como No-show. En ese caso: la residencia puede liberar la plaza; el fee EstuRed no es reembolsable, salvo normativa aplicable o decisión excepcional de EstuRed; la residencia puede retener o devolver importes según sus condiciones publicadas y los acuerdos aplicables; y EstuRed registra el evento internamente.",
      "Podés cancelar una solicitud antes de confirmar la reserva. Una vez confirmada, las cancelaciones quedan sujetas a las condiciones de la residencia, la política de fee EstuRed, la normativa aplicable, la evidencia disponible y la revisión de EstuRed cuando corresponda.",
      "Si la cancelación es atribuible a la residencia, EstuRed puede registrar el incidente, colaborar en la búsqueda de alternativas, evaluar el reintegro del fee y aplicar medidas internas a la residencia. Si es decisión del estudiante, el fee no es reembolsable, salvo normativa aplicable o decisión excepcional.",
    ],
  },
  {
    title: "22. Reclamos y Soporte",
    paras: [
      "Estudiantes, familiares y residencias pueden usar los canales de contacto para reportar problemas, dudas, diferencias o situaciones relevantes. Antes de iniciar la gestión de un caso, EstuRed puede mostrar un recordatorio de términos, alcance y límites de intervención, y puede decidir si un caso amerita intervención activa.",
      "La apertura de un reclamo no suspende automáticamente una solicitud, reserva, renovación o pago, salvo decisión manual de EstuRed.",
      "Durante la gestión de un caso, EstuRed puede solicitar evidencia, contactar a las partes, pedir información adicional, proponer soluciones, cerrar sin acción, registrar un acuerdo, aplicar medidas administrativas, evaluar el reembolso del fee y suspender usuarios o residencias. La intervención de EstuRed no implica garantía de resultado.",
      "Podés cargar evidencia como fotos, videos, capturas (incluyendo capturas de conversaciones de WhatsApp, ya que EstuRed no tiene acceso directo a ellas), audios u otros elementos pertinentes.",
    ],
  },
  {
    title: "23. Conducta del usuario y antidiscriminación",
    paras: [
      "Te comprometés a brindar información verdadera; actuar de buena fe; respetar a residencias, estudiantes, familiares, residentes y al equipo de EstuRed; no usar la plataforma para fraude, acoso, discriminación o abuso; no cargar documentación falsa; no suplantar identidad; no manipular solicitudes, propuestas, negociaciones, comprobantes, pagos o estados; no usar datos de otros usuarios fuera de la finalidad de alojamiento y convivencia; y no intentar vulnerar la seguridad, los permisos o la privacidad de la plataforma.",
      "EstuRed puede suspender, bloquear o limitar cuentas ante incumplimientos, abuso, riesgo, fraude, documentación falsa, maltrato, discriminación o uso indebido.",
      "EstuRed no admite conductas discriminatorias por motivos raciales, étnicos, religiosos, nacionales, de género, orientación sexual, discapacidad, condición social u otros criterios prohibidos por la normativa aplicable. Las residencias pueden declarar condiciones objetivas y públicas de admisión o convivencia cuando formen parte real del alojamiento ofrecido (por ejemplo, residencia femenina, masculina o mixta, habitaciones separadas por género, reglas de convivencia o requisitos operativos no discriminatorios). Podés reportar conductas discriminatorias por los canales de contacto de EstuRed; ante un comportamiento sistemático inadecuado, EstuRed puede suspender o expulsar de la red a la residencia o al usuario.",
    ],
  },
  {
    title: "24. Notificaciones y WhatsApp",
    paras: [
      "EstuRed envía notificaciones por email y dentro de la plataforma. Tenés que elegir al menos un canal de notificación, siendo el email el respaldo obligatorio. Sos responsable de mantener actualizados tus datos de contacto.",
      "Entre las notificaciones posibles están: propuesta de solicitud del familiar (recibida, aprobada, rechazada o vencida), solicitud enviada o recibida por la residencia, contacto establecido, propuesta de ajuste de condiciones, inicio del plazo de 48 horas, solicitud por vencer, pago a la residencia informado, fee pendiente o pagado, comprobante fiscal emitido, reserva confirmada, comprobante emitido, lista de espera, renovación y casos de Soporte.",
      "WhatsApp no es un canal de notificación de EstuRed y no existe integración con la API de WhatsApp Business. El único uso de WhatsApp es el enlace pre-formateado que la residencia acciona manualmente al establecer contacto. Su uso no elimina la necesidad de registrar los estados críticos dentro de EstuRed (contacto establecido, propuesta de ajuste, pago recibido, rechazo, cancelación, reserva confirmada, renovación e incidentes relevantes).",
    ],
  },
  {
    title: "25. Disponibilidad, responsabilidad de la residencia y sello Residencia Verificada",
    paras: [
      "La disponibilidad es informada o gestionada por cada residencia. En Modo Perfil Verificado, la disponibilidad requiere confirmación al solicitar; en Gestión Operativa puede tener mayor precisión si la residencia mantiene actualizado su inventario.",
      "Si una residencia informa disponibilidad incorrecta, cancela sin causa suficiente o no respeta las condiciones publicadas o acordadas, EstuRed puede registrar el incidente, intervenir en su resolución, reducir su visibilidad, suspenderla o tomar medidas internas. Puede ayudarte a buscar alternativas ante una cancelación imprevista atribuible a la residencia, pero no garantiza disponibilidad de reemplazo ni asume la prestación directa del alojamiento.",
      "El sello Residencia Verificada indica que EstuRed revisó la identidad responsable, la dirección y la similitud básica entre las fotos publicadas y los espacios reales mediante verificación presencial. No implica garantía absoluta sobre todos los servicios, certificación legal integral, garantía de convivencia futura, garantía de conducta de residentes o personal, garantía de inexistencia de conflictos ni sustitución de contratos o acuerdos particulares. Revisá las condiciones de cada residencia antes de avanzar.",
    ],
  },
  {
    title: "26. Datos personales y auditoría",
    paras: [
      "EstuRed trata datos personales para operar la plataforma: búsqueda, solicitudes, propuestas del familiar, negociación de condiciones, reservas, comprobantes, pagos y facturación del fee, comunidad visible, Soporte, seguridad, auditoría y mejora del servicio. Los datos deben ser adecuados, pertinentes y no excesivos para esa finalidad, y EstuRed implementa medidas razonables de seguridad, confidencialidad y control de acceso. El detalle está en la política de privacidad.",
      "EstuRed puede registrar auditoría sobre acciones críticas (creación y edición de cuenta, cambios de visibilidad, cargas documentales, propuestas y solicitudes, propuestas de ajuste, pagos, facturación del fee, comprobantes, contacto establecido, cancelaciones, reclamos, acciones de familiares vinculados y accesos a información sensible) para seguridad, Soporte, resolución de incidentes, prevención de abuso, cumplimiento operativo y mejora de la plataforma.",
    ],
  },
  {
    title: "27. Baja, suspensión y limitación de cuenta",
    paras: [
      "Podés solicitar la baja o eliminación de tu cuenta según los mecanismos disponibles y la normativa aplicable. La baja puede estar limitada temporalmente si existen operaciones activas, reservas, comprobantes, pagos, facturas, reclamos, obligaciones de auditoría o requisitos legales de conservación.",
      "EstuRed puede suspender, limitar o bloquear cuentas si detecta información o documentación falsa, fraude, abuso, maltrato, discriminación, uso indebido de datos, intentos de vulnerar la seguridad, incumplimiento de estos términos o riesgo para otros usuarios o para la plataforma.",
    ],
  },
  {
    title: "28. Aceptación digital",
    paras: [
      "La aceptación de estos términos puede realizarse mediante casilla de verificación, botón de aceptación, firma digital simple, aceptación dentro de la plataforma o cualquier mecanismo operativo definido por EstuRed.",
      "Aceptás que ciertas acciones críticas puedan requerir aceptaciones adicionales, por ejemplo: enviar una solicitud, crear o aprobar una propuesta de solicitud del familiar, responder a una propuesta de ajuste de condiciones, compartir documentos, hacer visible tu perfil, pagar el fee EstuRed, confirmar una renovación, iniciar un caso de Soporte, vincularte como familiar o avanzar siendo menor de edad.",
    ],
  },
  {
    title: "29. Residencias",
    paras: [
      "Las condiciones para residencias (alta, verificación, publicación y relación con EstuRed) son un documento propio, distinto de estos términos, publicado en /terms/residencias.",
    ],
  },
  {
    title: "30. Responsabilidad, modificaciones, ley aplicable y jurisdicción",
    paras: [
      "EstuRed responde por el servicio que presta: la plataforma, la gestión de solicitudes, la validación del fee y el comprobante. EstuRed no presta el alojamiento. La residencia responde por el alojamiento, sus condiciones, sus cobros y sus devoluciones.",
      "En la máxima medida permitida por la ley aplicable, y sin perjuicio de los derechos irrenunciables de los consumidores, EstuRed no responde por daños que provengan de actos u omisiones de la residencia o de otros usuarios.",
      "Podemos modificar estos términos. Te avisamos por email o en la app antes de que rijan. Si no estás de acuerdo, podés dejar de usar EstuRed. Los cambios no afectan solicitudes o reservas ya confirmadas. La fecha de última actualización figura al principio de esta página.",
      "Rigen las leyes de la República Argentina. Son competentes los tribunales ordinarios que correspondan. Si sos consumidor, podés reclamar ante los tribunales de tu domicilio y ante la autoridad de defensa del consumidor de tu jurisdicción, según la ley aplicable.",
    ],
  },
];

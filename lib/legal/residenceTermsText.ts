/**
 * «Condiciones para residencias» (`/terms/residencias`). Base: TP-04 de `docs/audits/TEXTOS_LEGALES_PROVISORIOS_2026-11-21.md`
 * (Ola 0 de la auditoría legal, LEG-013) y `docs/20`. §5 ya refleja DR65 (c): EstuRed no revisa ni aprueba los datos de cobro.
 * Es dato puro: la página lo muestra y `lib/legal/consentVersion.ts` calcula su hash. Se acepta con casilla propia al dar de alta
 * una residencia (invitación y alta directa del dueño).
 */
export interface ResidenceTermsSection {
  title: string;
  paras?: string[];
  items?: string[];
}

export const RESIDENCE_TERMS_SECTIONS: ResidenceTermsSection[] = [
  {
    title: "1. Partes y objeto",
    paras: [
      "Estas condiciones rigen entre el titular de EstuRed, identificado en los Términos y condiciones (sección «Quiénes somos»), y la persona o empresa que publica una residencia («la residencia»).",
      "EstuRed ofrece una plataforma para publicar la residencia, recibir solicitudes de estudiantes y gestionarlas. EstuRed no administra la residencia ni presta el alojamiento.",
    ],
  },
  {
    title: "2. Declaraciones de la residencia",
    paras: ["La residencia declara que:"],
    items: [
      "tiene derecho a ofrecer el alojamiento publicado;",
      "los datos, precios, habitaciones, servicios y reglamento que publica son veraces y están actualizados;",
      "cumple las habilitaciones y normas que le corresponden;",
      "no exige a los estudiantes garantía propietaria, salvo lo que acuerde por escrito con EstuRed.",
    ],
  },
  {
    title: "3. Verificación",
    paras: [
      "EstuRed visita la residencia y controla la identidad del responsable, la dirección y que las fotos coincidan con el lugar. La verificación tiene ese alcance. No certifica habilitaciones, seguridad edilicia, seguros ni calidad del servicio. Vence al año.",
    ],
  },
  {
    title: "4. Disponibilidad y solicitudes",
    paras: [
      "La residencia mantiene la disponibilidad al día. Una solicitud no es una reserva. La residencia acepta o rechaza cada solicitud por la plataforma.",
    ],
  },
  {
    title: "5. Cobro de la reserva y datos de cobro",
    paras: [
      "La residencia cobra la reserva directamente al estudiante, por los medios que carga en la plataforma. EstuRed no recibe, no retiene y no administra ese dinero.",
      "La residencia carga sus datos de cobro y responde por ellos. EstuRed no los revisa ni los aprueba, y no respalda el medio de pago ni la cuenta de destino. La residencia mantiene esos datos correctos y al día.",
      "La residencia informa en la plataforma cuando recibe el pago. La residencia es la única responsable de los cobros y devoluciones de lo que cobra, y de los reclamos que surjan de datos de cobro erróneos, desactualizados o falsos.",
      "El importe del pago de la reserva queda fijo en pesos al enviarse la solicitud de reserva, con la cotización de ese día y redondeado a múltiplos de 500 pesos. La residencia asume las variaciones del dólar hasta el cobro. Si cobra en dólares, vale el monto en dólares de la solicitud. Solo una propuesta de ajuste aceptada puede cambiar el importe.",
    ],
  },
  {
    title: "6. Contenido y fotos",
    paras: [
      "La residencia declara que tiene los derechos sobre las fotos, textos y marcas que sube. Si una foto muestra personas identificables, declara que tiene su autorización.",
      "Autoriza a EstuRed a publicar ese contenido en la plataforma y en sus canales, sin costo, mientras la residencia esté publicada y por un plazo razonable para retirarlo.",
    ],
  },
  {
    title: "7. Datos personales de estudiantes",
    paras: [
      "La residencia usa los datos y documentos de estudiantes solo para gestionar la solicitud y la estadía. No los copia fuera de la plataforma más de lo necesario. No los comparte con terceros. Cada apertura de un documento queda registrada.",
      "La residencia no pide por la plataforma certificados de antecedentes penales ni documentos con datos de salud.",
    ],
  },
  {
    title: "8. Datos personales de quien administra la residencia",
    paras: [
      "Los datos de la persona que administra la residencia y de su equipo se tratan según la Política de privacidad de EstuRed.",
    ],
  },
  {
    title: "9. Trato no discriminatorio",
    paras: [
      "La residencia no discrimina por nacionalidad, religión, origen, orientación sexual ni ningún otro motivo prohibido por la Ley 23.592. Las residencias para un solo género lo informan como política de la residencia.",
    ],
  },
  {
    title: "10. Planes",
    paras: [
      "Hoy las funciones de gestión son gratuitas para toda residencia verificada. Si en el futuro se cobran, se avisará con anticipación y nadie paga sin aceptarlo.",
    ],
  },
  {
    title: "11. Suspensión y baja",
    paras: [
      "EstuRed puede pausar o retirar la publicación ante datos falsos, reclamos fundados o incumplimientos, con aviso y motivo. La residencia puede pedir la baja cuando quiera, sin afectar las reservas ya confirmadas.",
    ],
  },
  {
    title: "12. Responsabilidad e indemnidad",
    paras: [
      "La residencia responde frente a EstuRed por los reclamos de terceros que surjan de su alojamiento, sus cobros, sus datos de cobro o su contenido.",
    ],
  },
  {
    title: "13. Modificaciones, ley y jurisdicción",
    paras: [
      "EstuRed avisa los cambios por email con anticipación. Rigen las leyes de la República Argentina y los tribunales ordinarios que correspondan.",
    ],
  },
];

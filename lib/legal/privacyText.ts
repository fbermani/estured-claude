/**
 * Texto de `/privacy`. Base: TP-01, TP-02 y TP-12 de `docs/audits/TEXTOS_LEGALES_PROVISORIOS_2026-11-21.md` (Ola 0 de la auditoría
 * legal), adaptados a la decisión del dueño de publicar los datos del titular solo en `/terms#quienes-somos`.
 * Es dato puro: la página lo muestra y `lib/legal/consentVersion.ts` calcula su hash. Solo describe lo que el código hace hoy.
 *
 * Condiciones de publicación (TP-01): §4 dice «estamos formalizando» las garantías hasta archivar los DPA (LEG-006); §6 describe la
 * cuenta del menor en espera hasta el consentimiento del familiar (DR65 (e)).
 */
import { LEGAL_OPERATOR } from "@/lib/legal/operator";

export interface PrivacySection {
  title: string;
  paras?: string[];
  items?: string[];
  /** Párrafos después de la lista. */
  after?: string[];
}

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: "1. Quién trata tus datos",
    paras: [
      "El responsable de tus datos es el titular de EstuRed. Su nombre, CUIT y domicilio figuran en los Términos y condiciones, sección «Quiénes somos».",
      `Para cualquier consulta sobre tus datos escribinos a ${LEGAL_OPERATOR.privacyEmail}.`,
    ],
  },
  {
    title: "2. Qué datos tratamos",
    items: [
      "Datos de cuenta: email, teléfono, nombre, apellido y fecha de nacimiento.",
      "Datos de perfil que elegís cargar: universidad, carrera, origen, biografía, hábitos, intereses y foto.",
      "Documentos que cargás para una residencia: documento de identidad, comprobante académico y otros que la residencia pida. No pedimos certificados de antecedentes penales.",
      "Tipo y número de documento de identidad.",
      "Datos del familiar vinculado y de quien paga el fee: nombre, documento, teléfono y datos fiscales.",
      "Comprobantes de pago que subís.",
      "Datos técnicos: dirección IP y tipo de navegador, para seguridad y para registrar tus aceptaciones.",
      "Si activás avisos en tu dispositivo: un identificador técnico de suscripción.",
      "Si llegaste por un enlace de una campaña: los parámetros de campaña de ese enlace, sin datos personales.",
    ],
  },
  {
    title: "3. Para qué los usamos",
    items: [
      "Crear y administrar tu cuenta.",
      "Gestionar solicitudes, negociaciones, reservas, comprobantes y el cobro del fee de EstuRed.",
      "Compartir con la residencia los datos necesarios para tu solicitud, según el estado de la solicitud.",
      "Mostrar tu perfil en la comunidad, solo si lo elegís.",
      "Enviarte avisos sobre tus trámites por email y, si los activás, por notificaciones.",
      "Prevenir abusos y proteger la seguridad del sitio.",
      "Cumplir obligaciones legales y fiscales.",
    ],
    after: ["No vendemos tus datos. No los usamos para publicidad de terceros."],
  },
  {
    title: "4. Con quién los compartimos",
    items: [
      "Con la residencia a la que enviás una solicitud, en la medida necesaria para gestionarla.",
      "Con tu familiar vinculado, en lo que la plataforma le permite ver.",
      "Con proveedores que nos prestan servicios técnicos: alojamiento de la base de datos y de los archivos; alojamiento del sitio; envío de emails; verificación antibots; íconos, tipografías y mapas que se cargan en tu navegador; servicios de notificaciones de tu navegador o teléfono.",
      "Con Meta, solo si aceptás las cookies de medición en el aviso de cookies (ver la sección 10).",
      "Con autoridades, cuando una ley o una orden judicial lo exija.",
    ],
    after: [
      "Algunos de estos proveedores están fuera de Argentina, por ejemplo en Brasil o en Estados Unidos. Estamos formalizando las garantías contractuales con estos proveedores, adecuadas a la Ley 25.326.",
    ],
  },
  {
    title: "5. Datos sensibles",
    paras: [
      "No te pedimos datos de salud, religión, origen étnico, opiniones políticas, vida sexual ni antecedentes penales. No los incluyas en campos de texto libre ni en documentos. Si una residencia te pide un documento que los contenga, podés negarte y avisar a Soporte.",
    ],
  },
  {
    title: "6. Menores de edad",
    paras: [
      "Si tenés entre 14 y 17 años, podés crear tu cuenta, pero queda en espera hasta que tu padre, tu madre o tu tutor se vincule y dé su consentimiento. Mientras tanto solo podés invitarlo y pedir ayuda a Soporte.",
      "Tu familiar responsable acepta estas condiciones en tu nombre y autoriza el tratamiento de tus datos para gestionar solicitudes y estadías.",
      "El perfil de un menor no se muestra en la comunidad. La residencia se comunica con el familiar vinculado.",
    ],
  },
  {
    title: "7. Cuánto tiempo los guardamos",
    paras: [
      "Guardamos tus datos el tiempo necesario para la finalidad para la que los diste. Después los eliminamos o los anonimizamos. Conservamos lo que una ley nos obliga a guardar, como los registros fiscales, por el plazo legal.",
    ],
  },
  {
    title: "8. Seguridad",
    paras: [
      "Aplicamos medidas técnicas y organizativas razonables. Los documentos se guardan en almacenamiento privado. Cada acceso de una residencia o del equipo de EstuRed a tus documentos queda registrado. Ningún sistema es infalible.",
    ],
  },
  {
    title: "9. Tus derechos",
    paras: [
      `Podés pedir acceso, rectificación, actualización o supresión de tus datos. Escribinos a ${LEGAL_OPERATOR.privacyEmail}. Indicá qué pedís y desde qué email tenés la cuenta. Te podemos pedir que confirmes tu identidad.`,
      "Respondemos el pedido de acceso dentro de 10 días corridos. Respondemos rectificación o supresión dentro de 5 días hábiles.",
      "Podés retirar tu consentimiento cuando quieras. Eso no afecta lo hecho antes.",
      "El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326.",
      "LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.",
    ],
  },
  {
    title: "10. Cookies y almacenamiento en tu dispositivo",
    paras: ["Usamos pocas herramientas en tu navegador:"],
    items: [
      "Cookie de sesión: mantiene tu sesión iniciada. Dura hasta que cerrás sesión o vence.",
      "Cookie de aviso de sesión: indica si tenés una sesión abierta. Dura hasta 400 días.",
      "Cookie de campaña: guarda los parámetros de campaña del enlace por el que llegaste, sin datos personales. Dura 30 días.",
      "Cookie de tu elección de cookies: recuerda si aceptaste o no las cookies de medición. Dura 180 días.",
      "Cookies de medición de Meta: miden campañas publicitarias. Se cargan solo si las aceptás en el aviso de cookies.",
      "Almacenamiento local: guarda borradores de formularios y preferencias de pantalla. Dura hasta que enviás el formulario o borrás los datos del navegador.",
      "Suscripción a avisos: te envía notificaciones, solo si las activaste. Dura hasta que las desactivás o cerrás sesión.",
    ],
    after: [
      "Al cargar el sitio, tu navegador se conecta con servicios de terceros: un servicio antibots en las pantallas de registro, un servicio de íconos y tipografías, y un servicio de mapas cuando ves un mapa. Esos servicios reciben tu dirección IP y datos técnicos del navegador.",
      "Los borradores quedan solo en tu dispositivo. Si usás una computadora compartida, borralos al terminar.",
    ],
  },
  {
    title: "11. Denuncias de contenido",
    paras: [
      "Si ves un perfil, una foto, una publicación o una pregunta que te parece ofensiva, discriminatoria o falsa, escribinos a Soporte. Revisamos cada denuncia. Si el contenido no cumple nuestras reglas, lo retiramos y avisamos a quien lo publicó.",
    ],
  },
  {
    title: "12. Cambios",
    paras: [
      "Si cambiamos esta política, te avisamos por email o en la app antes de que rija. La fecha de última actualización figura al principio de esta página.",
    ],
  },
];

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Qué datos recolecta EstuRed, para qué los usa, y cómo ejercer tus derechos sobre ellos.",
};

const CONTACT_EMAIL = "hola@estured.com";

const sections = [
  {
    title: "1. Qué datos recolectamos",
    body: (
      <>
        <p>
          Según cómo uses EstuRed, podemos recolectar: datos de tu cuenta (nombre, apellido, email, teléfono,
          nacionalidad, fecha de nacimiento, ciudad de origen, carrera, hábitos e intereses declarados), documentos
          que subís vos (DNI o pasaporte, constancia de estudio, comprobantes de pago, y otra documentación que te
          pida la residencia), y si te sumás a nuestra lista de espera: tu nombre, email, ciudad y el mensaje que
          nos dejes.
        </p>
        <p>
          Evitamos activamente pedir datos sensibles como salud, religión, ideología política, orientación sexual,
          origen étnico o antecedentes penales, salvo que vos los compartas voluntariamente (por ejemplo, para
          pedir una adaptación de accesibilidad).
        </p>
      </>
    ),
  },
  {
    title: "2. Para qué los usamos",
    body: (
      <p>
        Usamos tus datos para crear tu cuenta, mostrarte residencias, procesar tus solicitudes de reserva y las
        propuestas de tu familiar vinculado, gestionar negociaciones, administrar pagos y emitir comprobantes y
        facturas del fee EstuRed, verificar residencias, habilitar la comunidad visible (con tu configuración de
        privacidad), darte soporte, y cumplir obligaciones legales, fiscales y operativas. No usamos tus datos para
        fines distintos a estos sin pedirte un consentimiento adicional.
      </p>
    ),
  },
  {
    title: "3. Con quién compartimos tus datos",
    body: (
      <>
        <p>Compartimos datos solo cuando hace falta para el servicio, nunca de forma abierta o global:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Con la <strong>residencia</strong> a la que le enviaste una solicitud, o con la que tenés una reserva en
            proceso, confirmada o activa — nunca con residencias sin ese contexto.
          </li>
          <li>
            Con <strong>proveedores de pago</strong> (MercadoPago, PayU Argentina) para procesar el cobro del fee.
          </li>
          <li>
            Con <strong>TusFacturas.app</strong>, para emitir la Factura C del fee a nombre de quien paga.
          </li>
          <li>
            Con tu <strong>familiar vinculado</strong>, si consentiste explícitamente compartir tu teléfono al
            recibir una propuesta de su parte.
          </li>
        </ul>
        <p>
          Nunca hacemos públicos tu apellido completo, email, teléfono, fecha de nacimiento, universidad específica,
          documentos cargados, datos de pago, dirección, ni el contenido de una propuesta de tu familiar antes de
          que la apruebes.
        </p>
        <p>
          Nuestra infraestructura corre sobre proveedores cloud que pueden alojar datos fuera de Argentina; estamos
          validando las reglas exactas de transferencia internacional que corresponden.
        </p>
      </>
    ),
  },
  {
    title: "4. Menores de edad",
    body: (
      <>
        <p>
          Si sos menor de 18, no podés terminar tu registro sin un familiar vinculado. Por defecto, tu perfil tiene
          visibilidad más restringida (por ejemplo, sin foto real para visitantes). Vos seguís siendo quien aprueba
          o rechaza cualquier propuesta que te haga tu familiar — nunca la aprueba en tu lugar. Si sos menor, el
          contacto de la residencia se dirige siempre a tu familiar vinculado.
        </p>
        <p className="italic">
          El tratamiento de datos de usuarios menores de edad está sujeto a revisión legal adicional antes del
          lanzamiento público masivo de la plataforma.
        </p>
      </>
    ),
  },
  {
    title: "5. Cuánto tiempo conservamos tus datos",
    body: (
      <>
        <p>
          Conservamos tus datos mientras tengas una cuenta activa o mientras haga falta para operar tu reserva,
          soporte, auditoría, pagos y obligaciones fiscales. Podés pedir la baja de tu cuenta, la rectificación de
          tus datos, o la eliminación de datos que ya no sean necesarios.
        </p>
        <p>
          Si eliminás tu cuenta, conservamos un mínimo de trazabilidad de operaciones ya confirmadas (reserva, pago,
          comprobante, factura fiscal) cuando la ley nos obliga a hacerlo — y anonimizamos el resto de tus datos
          personales cuando es posible.
        </p>
        <p>
          Todavía no tenemos un plazo de retención exacto en años definido: estamos validando esa política con
          asesoría legal.
        </p>
      </>
    ),
  },
  {
    title: "6. Tus derechos",
    body: (
      <p>
        Bajo la Ley 25.326 de Protección de Datos Personales, tenés derecho a acceder, rectificar, actualizar y
        pedir la supresión de tus datos personales. Podés ejercer estos derechos escribiéndonos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-petrol-700 underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ),
  },
  {
    title: "7. Cómo pedir el borrado de tus datos",
    body: (
      <p>
        Hoy este proceso no es automático: escribinos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-petrol-700 underline">
          {CONTACT_EMAIL}
        </a>{" "}
        pidiendo la baja o eliminación de tu cuenta y lo gestionamos manualmente. Puede haber una demora si tenés
        operaciones activas, reclamos abiertos, u obligaciones legales o fiscales que nos obliguen a conservar
        cierta información igual.
      </p>
    ),
  },
  {
    title: "8. Cómo protegemos tus datos",
    body: (
      <p>
        Usamos control de acceso por rol, reglas de seguridad a nivel de base de datos, enlaces firmados y con
        vencimiento para tus documentos privados, y registramos auditoría de accesos sensibles.
      </p>
    ),
  },
  {
    title: "9. Contacto",
    body: (
      <p>
        Para cualquier consulta sobre esta política o tus datos personales, escribinos a{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-petrol-700 underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-petrol-800 sm:text-4xl">Política de privacidad</h1>
      <p className="mt-3 text-sm text-ink-faint">Última actualización: julio de 2026.</p>

      <div className="mt-6 rounded-field border border-warning-fg/20 bg-warning-bg px-4 py-3 text-sm text-warning-fg">
        <p>
          <strong>Este es un borrador operativo</strong>, escrito a partir de nuestras reglas internas de
          privacidad. Todavía está pendiente de revisión por un abogado antes de nuestro lanzamiento público
          masivo, y puede cambiar. Si tenés dudas puntuales, escribinos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>

      <p className="mt-8 text-ink-soft">
        EstuRed es una plataforma intermediaria de búsqueda, solicitud y reserva de alojamiento estudiantil. Esta
        página explica qué datos personales recolectamos, para qué los usamos, con quién los compartimos y cuáles
        son tus derechos sobre ellos.
      </p>

      <div className="mt-10 space-y-10">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-xl font-bold text-petrol-800">{s.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft sm:text-base">{s.body}</div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-ink-faint">
        Volver a{" "}
        <Link href="/" className="font-semibold text-petrol-700 underline">
          EstuRed
        </Link>
        .
      </p>
    </div>
  );
}

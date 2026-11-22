import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants/contact";
import { LEGAL_DOCUMENTS } from "@/lib/legal/versions";
import { OPERATOR_SECTION_HREF } from "@/lib/legal/operator";

/**
 * Textos legales de la preapertura (`consentimientos.html` v4, DR45). UNA sola fuente: la usan la pantalla `/consentimientos`
 * y las secciones «Preapertura» de `/terms` y `/privacy` (solo con el flag encendido), así no se duplican ni se desalinean.
 * RIESGO ASUMIDO POR EL DUEÑO: sin validación legal frente a la Ley 25.326 (docs/23 §5). El responsable es el titular de
 * `/terms#quienes-somos` (LEG-001, decisión del dueño 2026-11-22: sus datos se publican solo ahí).
 */

const list = "list-disc space-y-1.5 pl-5";
const h3 = "pt-2 font-display text-lg font-bold text-ink";

/** Las dos líneas de casillero del flujo (paso 1 y paso 2). Hacen de vínculo entre el registro y el texto completo. */
export function ConsentLines() {
  return (
    <div className="grid gap-3">
      <div className="rounded-field border-[1.5px] border-forest bg-forest-tint p-4">
        <p className="mb-1 text-sm font-bold text-forest-700">Estudiante, paso 1 (obligatorio)</p>
        <p className="text-ink">
          Acepto los <b>Términos</b> y la <b>Privacidad</b>, incluido mostrar mi búsqueda sin nombre ni contacto a residencias verificadas.
        </p>
      </div>
      <div className="rounded-field border-[1.5px] border-line-2 bg-cream p-4">
        <p className="mb-1 text-sm font-bold text-ink-soft">Familiar, paso 1 (obligatorio)</p>
        <p className="text-ink">
          Acepto los <b>Términos</b> y la <b>Privacidad</b>.
        </p>
      </div>
      <div className="rounded-field border-[1.5px] border-line-2 bg-cream p-4">
        <p className="mb-1 text-sm font-bold text-ink-soft">Comunidad pública, paso 2 (opcional, empieza sin tildar)</p>
        <p className="text-ink">Mostrar mi perfil (nombre, edad, país, carrera, hábitos e intereses) en la comunidad de la web.</p>
      </div>
      <div className="rounded-field border-[1.5px] border-line-2 bg-cream p-4">
        <p className="mb-1 text-sm font-bold text-ink-soft">Residencias, formulario</p>
        <p className="text-ink">Al enviar aceptás la Política de privacidad.</p>
      </div>
      <p className="text-sm text-ink-soft">
        Los permisos de búsqueda y de comunidad los acepta cada estudiante en su propio registro: un familiar no puede darlos por él. La opción de
        mostrar tu búsqueda a residencias se explica en los Términos de abajo y la podés desactivar cuando quieras.
      </p>
    </div>
  );
}

/** Términos de la preapertura: reglas del acceso anticipado, la búsqueda para residencias (opción C) y la comunidad pública. */
export function PreaperturaTermsBody() {
  return (
    <div className="grid gap-3 text-[15px] leading-relaxed text-ink-soft">
      <p>
        EstuRed es una plataforma que conecta estudiantes y familias con residencias estudiantiles de Buenos Aires. Hoy está en <b>preapertura</b>:
        todavía no abrió y no se pueden mandar solicitudes ni reservar.
      </p>
      <ul className={list}>
        <li>
          Para crear una cuenta tenés que tener 18 años o más. Si sos menor, te sumás solo con la invitación de un familiar mayor de edad, que se
          registra primero: sus cuentas quedan conectadas, tu perfil no aparece en la comunidad pública y tu búsqueda no se muestra a residencias.
        </li>
        <li>Sumarte no tiene costo y no reserva un lugar en ninguna residencia.</li>
        <li>No hay fecha de apertura confirmada. Te avisamos por mail cuando abramos.</li>
        <li>Tu lugar en la lista indica el orden en que te sumaste; no da prioridad para conseguir un lugar.</li>
        <li>Cuando abramos, cada solicitud a una residencia queda sujeta a su confirmación.</li>
        <li>Las tarjetas marcadas «Ejemplo» son ilustrativas: no son personas reales.</li>
        <li>
          <b className="text-ink">Tu búsqueda para residencias:</b> al aceptar estos Términos, tu búsqueda (tipo de habitación, mes de ingreso y
          universidad) se muestra sin tu nombre ni contacto a residencias verificadas. Si una se interesa, confirmás con un clic si le pasamos tu
          nombre y email. La residencia donde vivís hoy nunca la ve. La podés desactivar cuando quieras escribiendo a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-forest-700 underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          .
        </li>
        <li>
          <b className="text-ink">Comunidad pública:</b> solo si tildás la casilla. Tu tarjeta (nombre sin apellido, edad, país, carrera, hábitos e
          intereses) se ve en la web pública, para cualquiera. Nunca tu apellido, contacto ni dónde vivís. La quitás cuando quieras desde «Editar mi
          perfil» y desaparece.
        </li>
        <li>Podés cerrar tu cuenta cuando quieras escribiéndonos.</li>
      </ul>
    </div>
  );
}

/** Política de privacidad, versión preapertura. El responsable legal y la fecha de vigencia quedan marcados hasta que el dueño los defina. */
export function PreaperturaPrivacyBody() {
  const mail = (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-forest-700 underline underline-offset-2">
      {CONTACT_EMAIL}
    </a>
  );
  return (
    <div className="grid gap-3 text-[15px] leading-relaxed text-ink-soft">
      <p className="text-sm">
        Versión de la preapertura, vigente desde el {LEGAL_DOCUMENTS.privacy.updatedLabel}.
      </p>
      <h3 className={h3}>Quién es responsable de tus datos</h3>
      <p>
        El responsable de la base de datos es el titular que opera EstuRed. Su nombre, CUIT y domicilio figuran en{" "}
        <Link href={OPERATOR_SECTION_HREF} className="font-bold text-forest-700 underline underline-offset-2">
          Términos y condiciones › Quiénes somos
        </Link>
        . Contacto: {mail}.
      </p>
      <h3 className={h3}>Qué datos pedimos</h3>
      <ul className={list}>
        <li>
          <b className="text-ink">Para tu cuenta:</b> email, contraseña (guardada cifrada), fecha de nacimiento y si sos estudiante o familiar.
        </li>
        <li>
          <b className="text-ink">Tu perfil:</b> nombre, país y provincia, universidad, carrera, mes de ingreso, tipo de habitación, hábitos, intereses
          y si ya vivís en una residencia (y cuál).
        </li>
        <li>
          <b className="text-ink">Familiares:</b> el email del estudiante que acompañás.
        </li>
        <li>
          <b className="text-ink">Residencias:</b> nombre y dirección de la residencia, responsable, email y teléfono.
        </li>
      </ul>
      <p>No pedimos presupuesto, documentos ni datos de pago en la preapertura.</p>
      <h3 className={h3}>Para qué los usamos</h3>
      <ul className={list}>
        <li>Crear y mantener tu cuenta.</li>
        <li>Avisarte cuando EstuRed abra y contarte novedades de la preapertura.</li>
        <li>
          Mostrar tu búsqueda sin nombre ni contacto a residencias verificadas (Términos) y, si la activás, tu tarjeta en la comunidad pública.
        </li>
        <li>Medir cuántas personas se suman, siempre en números totales.</li>
      </ul>
      <h3 className={h3}>Con quién los compartimos</h3>
      <ul className={list}>
        <li>
          <b className="text-ink">Residencias verificadas:</b> solo tu búsqueda sin nombre ni contacto. Tu nombre y email, solo si confirmás que una
          residencia te contacte.
        </li>
        <li>
          <b className="text-ink">Cualquier visitante de la web:</b> tu tarjeta de comunidad, solo si la activaste.
        </li>
        <li>
          <b className="text-ink">Tu familiar vinculado:</b> tu búsqueda, solo si aceptaste su invitación.
        </li>
        <li>
          <b className="text-ink">Proveedores que nos dan servicio:</b> alojamiento de la base de datos y de la web, y envío de mails. Algunos
          guardan datos fuera de Argentina; al aceptar esta política consentís esa transferencia.
        </li>
      </ul>
      <p>Nunca vendemos tus datos ni los usamos para publicidad de terceros.</p>
      <h3 className={h3}>Menores de edad</h3>
      <p>
        Las cuentas son para mayores de 18. Un menor solo puede sumarse con la invitación de un familiar mayor de edad registrado en EstuRed; sus
        cuentas quedan conectadas y su perfil nunca aparece en la comunidad pública.
      </p>
      <h3 className={h3}>Cuánto tiempo los guardamos</h3>
      <p>
        Mientras tengas cuenta. Si la cerrás, borramos tus datos dentro de los 30 días, salvo lo que la ley nos obligue a conservar. La tarjeta de
        comunidad se quita de la web apenas la desactivás.
      </p>
      <h3 className={h3}>Tus derechos</h3>
      <p>
        Podés pedir acceso a tus datos (gratis, cada seis meses), corregirlos, actualizarlos o borrarlos, y retirar cualquier permiso cuando quieras,
        escribiendo a {mail}. Respondemos pedidos de acceso en 10 días corridos y de corrección o borrado en 5 días hábiles.
      </p>
      <h3 className={h3}>Cookies</h3>
      <p>Usamos solo las cookies necesarias para que inicies sesión.</p>
      <h3 className={h3}>Cambios</h3>
      <p>Si cambiamos esta política, te avisamos por mail antes de que rija.</p>
      <p className="border-t border-line pt-3 text-sm text-ink-soft">
        LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las
        denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de
        protección de datos personales.
      </p>
    </div>
  );
}

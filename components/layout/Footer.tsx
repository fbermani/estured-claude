import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/constants/contact";

export function Footer({ hideSignup = false }: { hideSignup?: boolean } = {}) {
  return (
    <footer className="border-t border-line bg-forest-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-xl font-bold">EstuRed</p>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            La convivencia también se elige. Residencias estudiantiles
            verificadas en CABA, con solicitudes claras y comprobantes
            respaldados.
          </p>
        </div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-white/60">
            Explorar
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <Link
                href="/search"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Buscar residencias
              </Link>
            </li>
            <li>
              <Link
                href="/for-students"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Para estudiantes y familias
              </Link>
            </li>
            <li>
              <Link
                href="/for-residences"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Para residencias
              </Link>
            </li>
            {!hideSignup && (
            <li>
              <Link
                href="/register"
                className="rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Crear cuenta
              </Link>
            </li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide text-white/60">
            Confianza
          </p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>Residencias verificadas presencialmente</li>
            <li>Solicitudes registradas y auditables</li>
            <li>Comprobante de Reserva Confirmada</li>
            <li className="pt-2">
              Contacto:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-white/60">
            EstuRed actúa como plataforma intermediaria de búsqueda, solicitud,
            registro y comprobante. No presta directamente el alojamiento. Los
            precios en ARS son referenciales al dólar blue del día.{" "}
            <Link href="/students/revocation" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Botón de arrepentimiento
            </Link>
            {" · "}
            <Link href="/verify" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Verificar un comprobante
            </Link>
            {" · "}
            <Link href="/terms" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Términos y condiciones
            </Link>
            {" · "}
            <Link href="/privacy" className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Política de privacidad
            </Link>
            .
          </p>
          <p className="shrink-0 text-xs text-white/60">
            Hecho con <span aria-hidden>♥</span> en Buenos Aires
          </p>
        </div>
      </div>
    </footer>
  );
}

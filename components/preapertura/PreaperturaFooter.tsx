import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { CONTACT_EMAIL } from "@/lib/constants/contact";

const legalLink =
  "inline-flex min-h-11 items-center rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:min-h-8";

/** Footer de la preapertura (DR42.2): firma, contacto y legales. Sin buscador ni «Guías». */
export function PreaperturaFooter() {
  return (
    <footer className="border-t border-line bg-forest-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <BrandMark size={36} tone="dark" />
          <span className="sr-only">EstuRed</span>
          <p className="mt-2 max-w-sm text-sm text-white/80">La convivencia también se elige.</p>
        </div>
        <p className="text-sm text-white/80">
          Contacto:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <p className="text-xs text-white/70">
            EstuRed actúa como plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta directamente el
            alojamiento.
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-5 text-xs text-white/80">
            <li>
              <Link href="/students/revocation" className={legalLink}>
                Botón de arrepentimiento
              </Link>
            </li>
            <li>
              <Link href="/verify" className={legalLink}>
                Verificar un comprobante
              </Link>
            </li>
            <li>
              <Link href="/consentimientos#terminos" className={legalLink}>
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link href="/consentimientos#privacidad" className={legalLink}>
                Política de privacidad
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

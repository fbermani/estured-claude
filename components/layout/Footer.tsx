import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { Icon } from "@/components/ui/Icon";
import { CONTACT_EMAIL } from "@/lib/constants/contact";

const link =
  "inline-flex min-h-11 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:min-h-9";
const legalLink =
  "inline-flex min-h-11 items-center rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:min-h-9";

/** B2: firma de marca + 2 grupos de links + legal en una línea. */
export function Footer({ hideSignup = false }: { hideSignup?: boolean } = {}) {
  return (
    <footer className="border-t border-line bg-forest-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <BrandMark size={36} tone="dark" />
          <span className="sr-only">EstuRed</span>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            La convivencia también se elige. Residencias estudiantiles
            verificadas en CABA, con solicitudes registradas y comprobantes
            verificables.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm text-white/80">
            {["Residencias verificadas presencialmente", "Solicitudes registradas en la plataforma", "Comprobante de Reserva Confirmada"].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 text-base text-amber-soft-300" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Explorar">
          <p className="text-sm font-bold text-white/60">Explorar</p>
          <ul className="mt-2 text-sm text-white/80">
            <li>
              <Link href="/search" className={link}>
                Buscar residencias
              </Link>
            </li>
            <li>
              <Link href="/for-students" className={link}>
                Para estudiantes y familias
              </Link>
            </li>
            <li>
              <Link href="/for-residences" className={link}>
                Para residencias
              </Link>
            </li>
            <li>
              <Link href="/guias" className={link}>
                Guías
              </Link>
            </li>
            {!hideSignup && (
              <li>
                <Link href="/register" className={link}>
                  Crear cuenta
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <nav aria-label="Ayuda">
          <p className="text-sm font-bold text-white/60">Ayuda</p>
          <ul className="mt-2 text-sm text-white/80">
            <li>
              <Link href="/students/support" className={`${link} gap-1.5 font-semibold text-white`}>
                <Icon name="support_agent" className="text-lg text-amber-soft-300" />
                Soporte
              </Link>
            </li>
            <li>
              <Link href="/for-students#preguntas-frecuentes" className={link}>
                Preguntas frecuentes
              </Link>
            </li>
            <li>
              <Link href="/#el-proceso" className={link}>
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link href="/for-students#que-pagas" className={link}>
                Qué pagás y a quién
              </Link>
            </li>
            <li className="py-2">
              Contacto:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="rounded-sm underline transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li className="text-xs text-white/60">¿Tenés una reserva y algo no coincide? Abrí un caso desde tu panel.</li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="text-xs text-white/60">
            EstuRed actúa como plataforma intermediaria de búsqueda, solicitud, registro y comprobante. No presta
            directamente el alojamiento. Los precios en ARS son referenciales al dólar blue del día.
          </p>
          <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <ul className="flex flex-wrap gap-x-5 text-xs text-white/70">
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
                <Link href="/terms" className={legalLink}>
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={legalLink}>
                  Política de privacidad
                </Link>
              </li>
            </ul>
            <p className="text-xs text-white/60">
              Hecho con <span aria-hidden>♥</span> en Buenos Aires
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
